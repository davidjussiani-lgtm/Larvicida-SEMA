#!/usr/bin/env python3
import sys
import zipfile
import os
import xml.etree.ElementTree as ET
import json
import csv

def ensure_dir(p):
    os.makedirs(p, exist_ok=True)

def extract_kmz(kmz_path, out_dir):
    ensure_dir(out_dir)
    with zipfile.ZipFile(kmz_path, 'r') as z:
        # find the main KML file (usually doc.kml)
        names = z.namelist()
        kml_name = None
        for n in names:
            if n.lower().endswith('.kml'):
                kml_name = n
                break
        if not kml_name:
            raise SystemExit('No KML file found inside KMZ')
        z.extract(kml_name, out_dir)
        extracted_kml = os.path.join(out_dir, kml_name)
        return extracted_kml

def parse_kml(kml_path):
    ns = {'kml':'http://www.opengis.net/kml/2.2'}
    tree = ET.parse(kml_path)
    root = tree.getroot()
    # Find all Placemark elements
    placemarks = root.findall('.//{http://www.opengis.net/kml/2.2}Placemark')
    features = []
    point_rows = []
    for pm in placemarks:
        name_el = pm.find('{http://www.opengis.net/kml/2.2}name')
        name = name_el.text if name_el is not None else ''
        desc_el = pm.find('{http://www.opengis.net/kml/2.2}description')
        desc = desc_el.text if desc_el is not None else ''
        props = {'name': name, 'description': desc}
        # ExtendedData
        ed = pm.find('{http://www.opengis.net/kml/2.2}ExtendedData')
        if ed is not None:
            for dv in ed.findall('.//{http://www.opengis.net/kml/2.2}Data'):
                key = dv.get('name') or ''
                val_el = dv.find('{http://www.opengis.net/kml/2.2}value')
                val = val_el.text if val_el is not None else ''
                props[key] = val
        # Look for Point, LineString, Polygon
        geom = None
        pt = pm.find('.//{http://www.opengis.net/kml/2.2}Point')
        if pt is not None:
            coord = pt.find('{http://www.opengis.net/kml/2.2}coordinates')
            if coord is not None and coord.text:
                lon,lat,*rest = coord.text.strip().split(',')
                geom = { 'type':'Point', 'coordinates':[float(lon), float(lat)] }
                point_rows.append({'name':name,'description':desc,'lon':lon,'lat':lat})
        ls = pm.find('.//{http://www.opengis.net/kml/2.2}LineString')
        if ls is not None:
            coord = ls.find('{http://www.opengis.net/kml/2.2}coordinates')
            if coord is not None and coord.text:
                coords = []
                for c in coord.text.strip().split():
                    lon,lat,*_ = c.split(',')
                    coords.append([float(lon),float(lat)])
                geom = {'type':'LineString','coordinates':coords}
        poly = pm.find('.//{http://www.opengis.net/kml/2.2}Polygon')
        if poly is not None:
            outer = poly.find('.//{http://www.opengis.net/kml/2.2}outerBoundaryIs')
            if outer is not None:
                lr = outer.find('.//{http://www.opengis.net/kml/2.2}coordinates')
                if lr is not None and lr.text:
                    rings = []
                    coords = []
                    for c in lr.text.strip().split():
                        lon,lat,*_ = c.split(',')
                        coords.append([float(lon),float(lat)])
                    rings.append(coords)
                    geom = {'type':'Polygon','coordinates':rings}
        if geom is None:
            # fallback: skip
            continue
        features.append({'type':'Feature','geometry':geom,'properties':props})
    return {'type':'FeatureCollection','features':features}, point_rows

def save_geojson(fc, out_path):
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(fc, f, ensure_ascii=False, indent=2)

def save_csv(rows, out_path):
    if not rows:
        return
    keys = ['name','description','lon','lat']
    with open(out_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        for r in rows:
            writer.writerow(r)

def main():
    if len(sys.argv) < 2:
        print('Usage: extract_kmz.py <path-to-kmz>')
        sys.exit(1)
    kmz = sys.argv[1]
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(base, 'data')
    ensure_dir(out_dir)
    print('Extracting KMZ:', kmz)
    kml_path = extract_kmz(kmz, out_dir)
    print('Parsed kml at:', kml_path)
    geojson, points = parse_kml(kml_path)
    gj_path = os.path.join(out_dir, 'map.geojson')
    csv_path = os.path.join(out_dir, 'map_points.csv')
    save_geojson(geojson, gj_path)
    save_csv(points, csv_path)
    summary = {
        'kml': os.path.basename(kml_path),
        'geojson': os.path.basename(gj_path),
        'points_csv': os.path.basename(csv_path),
        'feature_count': len(geojson.get('features',[])),
        'point_count': len(points)
    }
    with open(os.path.join(out_dir,'map_summary_extracted.json'),'w',encoding='utf-8') as f:
        json.dump(summary,f,ensure_ascii=False,indent=2)
    print('Wrote:', gj_path, csv_path)
    print('Summary:', summary)

if __name__ == '__main__':
    main()

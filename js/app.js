const summaryEl = document.getElementById('summary')
const layersEl = document.getElementById('layers')
const kmlLink = document.getElementById('kmlLink')

// Initialize Leaflet map
const map = L.map('map').setView([-15.8, -47.9], 6)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap'
}).addTo(map)

// Containers for layer control
let pointsLayer = L.layerGroup().addTo(map)
let linesLayer = L.layerGroup().addTo(map)
let polysLayer = L.layerGroup().addTo(map)

function bindPopup(feature, layer){
  const props = feature.properties || {}
  let html = '<div>'
  if (props.name) html += `<strong>${props.name}</strong><br/>`
  if (props.description) html += `<div>${props.description}</div>`
  // show some other props
  const keys = Object.keys(props).filter(k=>k !== 'name' && k !== 'description')
  if (keys.length){
    html += '<hr/><small>'
    keys.forEach(k=>{ html += `<strong>${k}:</strong> ${props[k]}<br/>` })
    html += '</small>'
  }
  html += '</div>'
  layer.bindPopup(html)
}

// Load summary and set KML/CSV links
fetch('data/map_summary.json')
  .then(r=>r.json())
  .then(data=>{
    summaryEl.innerHTML = `<p><strong>Título:</strong> ${data.title}</p><p>${data.description}</p>`
    kmlLink.href = data.kml_url
    // add download links for generated files
    const dlGeo = document.createElement('a')
    dlGeo.href = 'data/map.geojson'
    dlGeo.textContent = 'Baixar GeoJSON'
    dlGeo.className = 'button'
    dlGeo.style.marginLeft='0.5rem'
    kmlLink.insertAdjacentElement('afterend', dlGeo)
    const dlCsv = document.createElement('a')
    dlCsv.href = 'data/map_points.csv'
    dlCsv.textContent = 'Baixar CSV (pontos)'
    dlCsv.className = 'button'
    dlCsv.style.marginLeft='0.5rem'
    dlGeo.insertAdjacentElement('afterend', dlCsv)
    // Prepare Google embed toggle
    let mid = null
    try {
      const u = new URL(data.kml_url)
      mid = u.searchParams.get('mid')
    } catch (e) {
      // fallback: try to extract mid with regex
      const m = /mid=([A-Za-z0-9_-]+)/.exec(data.kml_url)
      if (m) mid = m[1]
    }
    const showGoogleBtn = document.getElementById('showGoogle')
    const showLocalBtn = document.getElementById('showLocal')
    const mapWrap = document.getElementById('map-wrap')
    let googleIframe = null
    function showGoogle() {
      if (!mid) { alert('ID do mapa Google não encontrado.'); return }
      if (!googleIframe) {
        googleIframe = document.createElement('iframe')
        googleIframe.src = `https://www.google.com/maps/d/embed?mid=${mid}`
        googleIframe.style.width = '100%'
        googleIframe.style.height = '100%'
        googleIframe.style.border = '0'
        googleIframe.id = 'googleEmbed'
        // append inside map-wrap, hide leaflet container
        mapWrap.querySelector('#map').style.display = 'none'
        mapWrap.appendChild(googleIframe)
      } else {
        mapWrap.querySelector('#map').style.display = 'none'
        googleIframe.style.display = 'block'
      }
    }
    function showLocal() {
      if (googleIframe) { googleIframe.style.display = 'none' }
      const mapDiv = mapWrap.querySelector('#map')
      mapDiv.style.display = 'block'
      setTimeout(()=>{ map.invalidateSize() }, 200)
    }
    if (showGoogleBtn) showGoogleBtn.addEventListener('click', showGoogle)
    if (showLocalBtn) showLocalBtn.addEventListener('click', showLocal)
  })
  .catch(err=>{
    summaryEl.textContent = 'Não foi possível carregar os metadados do mapa.'
    console.error(err)
  })

// Load GeoJSON and split by geometry type
fetch('data/map.geojson')
  .then(r=>r.json())
  .then(gj=>{
    const points = L.geoJSON(gj, {
      filter: f => f.geometry && f.geometry.type === 'Point',
      pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius:6, fillColor:'#2b7', color:'#046', weight:1, fillOpacity:0.9 }),
      onEachFeature: bindPopup
    }).addTo(pointsLayer)

    const lines = L.geoJSON(gj, {
      filter: f => f.geometry && f.geometry.type === 'LineString',
      style: { color:'#3388ff', weight:3 },
      onEachFeature: bindPopup
    }).addTo(linesLayer)

    const polys = L.geoJSON(gj, {
      filter: f => f.geometry && f.geometry.type === 'Polygon',
      style: { color:'#ff7800', weight:2, fillOpacity:0.2 },
      onEachFeature: bindPopup
    }).addTo(polysLayer)

    // layer control
    const overlays = { 'Pontos': pointsLayer, 'Linhas': linesLayer, 'Polígonos': polysLayer }
    L.control.layers(null, overlays, { collapsed: false }).addTo(map)

    // fit to data
    const all = L.featureGroup([points, lines, polys])
    map.fitBounds(all.getBounds(), { padding: [20,20] })

    // populate layers list in sidebar (counts)
    const layersElInner = document.getElementById('layers')
    layersElInner.innerHTML = ''
    const items = [ ['Pontos', points.getLayers().length], ['Linhas', lines.getLayers().length], ['Polígonos', polys.getLayers().length] ]
    items.forEach(it=>{
      const li = document.createElement('li')
      li.innerHTML = `<strong>${it[0]}</strong> <div class="muted">${it[1]} itens</div>`
      layersElInner.appendChild(li)
    })
  })
  .catch(err=>{
    console.error('Erro carregando GeoJSON', err)
  })

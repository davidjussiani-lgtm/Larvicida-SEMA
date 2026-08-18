const summaryEl = document.getElementById('summary')
const layersEl = document.getElementById('layers')
const kmlLink = document.getElementById('kmlLink')

// Initialize Leaflet map and basemaps
const map = L.map('map').setView([-15.8, -47.9], 6)
const tileBasic = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap'
})
const tileSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics'
})
// start with basic basemap
tileBasic.addTo(map)

function setBasemap(mode){
  if (mode === 'sat'){
    if (map.hasLayer(tileBasic)) map.removeLayer(tileBasic)
    if (!map.hasLayer(tileSat)) map.addLayer(tileSat)
  } else {
    if (map.hasLayer(tileSat)) map.removeLayer(tileSat)
    if (!map.hasLayer(tileBasic)) map.addLayer(tileBasic)
  }
}

// Containers for layer control
const folderLayers = {} // map folder name -> LayerGroup
const generic = {
  points: L.layerGroup().addTo(map),
  lines: L.layerGroup().addTo(map),
  polys: L.layerGroup().addTo(map)
}

function bindPopup(feature, layer){
  const props = feature.properties || {}
  let html = '<div>'
  // show anonymized collaborator name when feature belongs to volunteer list
  if (props.folder === 'Lista de Aplicadores Voluntarios' && props._anonName) {
    // For volunteer list show only the anonymized collaborator identifier
    html += `<strong>${props._anonName}</strong>`
    html += '</div>'
    layer.bindPopup(html)
    return
  }
  // For rivers, show only the name and hide all other details
  if (props.folder === 'Rios') {
    if (props.name) html += `<strong>${props.name}</strong>`
    else html += '<strong>Rio</strong>'
    html += '</div>'
    layer.bindPopup(html)
    return
  }
  if (props.name) html += `<strong>${props.name}</strong><br/>`
  if (props.description) html += `<div>${props.description}</div>`
  // show some other props (exclude common long fields and internal metadata like folder/styleUrl)
  const keys = Object.keys(props).filter(k=>!['name','description','_anonName','folder','styleUrl'].includes(k))
  if (keys.length){
    html += '<hr/><small>'
    keys.forEach(k=>{ html += `<strong>${k}:</strong> ${props[k]}<br/>` })
    html += '</small>'
  }
  html += '</div>'
  layer.bindPopup(html)
}

// Load summary and prepare Google embed toggle (no download links)
fetch('data/map_summary.json')
  .then(r=>r.json())
  .then(data=>{
    summaryEl.innerHTML = `<p><strong>Título:</strong> ${data.title}</p><p>${data.description}</p>`
    // Prepare Google embed toggle (extract mid from kml_url)
    let mid = null
    try {
      const u = new URL(data.kml_url)
      mid = u.searchParams.get('mid')
    } catch (e) {
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

// Load GeoJSON and split by geometry type and folder
fetch('data/map.geojson')
  .then(r=>r.json())
  .then(gj=>{
    // helper: extract hex color from styleUrl like '#icon-1831-0F9D58'
    function colorFromStyle(s) {
      if (!s) return null
      const m = /-([A-Fa-f0-9]{6})/.exec(s)
      return m ? `#${m[1]}` : null
    }

    // create features layer but route features into folder-based LayerGroups
    // collaborator counters to anonymize names inside volunteer folder
    const collabCounters = {}

    // prepare custom icons
    const mosquitoIcon = L.icon({ iconUrl: 'assets/mosquito.svg', iconSize: [28,28], iconAnchor: [14,28], popupAnchor: [0,-26] })

    const geo = L.geoJSON(gj, {
      pointToLayer: (f, latlng) => {
        const props = f.properties || {}
        // use mosquito icon for SEMA application points
        if (props.folder === 'Aplicação Realizada pela SEMA' || props.folder === 'Aplicação Realizada pela SEMA ') {
          return L.marker(latlng, { icon: mosquitoIcon })
        }
        const hex = colorFromStyle(props.styleUrl) || '#2b7'
        return L.circleMarker(latlng, { radius:6, fillColor:hex, color:hex, weight:1, fillOpacity:0.9 })
      },
      style: (f) => {
        const props = f.properties || {}
        const hex = colorFromStyle(props.styleUrl) || '#ff7800'
        return { color: hex, weight: 2, fillColor: hex, fillOpacity: 0.2 }
      },
      onEachFeature: (f, layer) => {
        const props = f.properties || {}
        const folder = props.folder || (props.layerName) || (props.collection) || 'Sem Camada'
        // anonymize volunteer names
        if (folder === 'Lista de Aplicadores Voluntarios') {
          if (!collabCounters[folder]) collabCounters[folder] = 0
          collabCounters[folder] += 1
            props._anonName = `Colaborador ${collabCounters[folder]}`
            // remove other sensitive/extra properties from volunteer features so only the collaborator label remains
            Object.keys(props).forEach(k=>{
              if (!['_anonName','folder'].includes(k)) delete props[k]
            })
        }
        bindPopup(f, layer)
        if (!folderLayers[folder]) { folderLayers[folder] = L.layerGroup(); }
        folderLayers[folder].addLayer(layer)
        // also add to generic by geometry
        if (f.geometry && f.geometry.type === 'Point') generic.points.addLayer(layer)
        if (f.geometry && f.geometry.type === 'LineString') generic.lines.addLayer(layer)
        if (f.geometry && f.geometry.type === 'Polygon') generic.polys.addLayer(layer)
      }
    })

    // build overlays object: include only the named folders the user requested
    const overlays = {}
    const desired = ['Aplicação Realizada pela SEMA', 'Lista de Aplicadores Voluntarios', 'Rios']
    desired.forEach(name => {
      // ensure a LayerGroup exists for the desired folder
      if (!folderLayers[name]) folderLayers[name] = L.layerGroup().addTo(map)
      overlays[name] = folderLayers[name]
    })

    L.control.layers(null, overlays, { collapsed: false }).addTo(map)

    // fit to data (all layers)
    const allLayers = []
    Object.values(folderLayers).forEach(lg=> allLayers.push(lg))
    allLayers.push(generic.points, generic.lines, generic.polys)
    const all = L.featureGroup(allLayers.reduce((acc, lg)=> acc.concat(lg.getLayers ? lg.getLayers() : []), []))
    if (all.getLayers().length) map.fitBounds(all.getBounds(), { padding: [20,20] })

    // populate sidebar layers list showing only the desired folders
    const layersElInner = document.getElementById('layers')
    layersElInner.innerHTML = ''
    desired.forEach(fn=>{
      const lg = folderLayers[fn]
      const count = lg && lg.getLayers ? lg.getLayers().length : 0
      const li = document.createElement('li')
      li.innerHTML = `<strong>${fn}</strong> <div class="muted">${count} itens</div>`
      layersElInner.appendChild(li)
    })
  })
  .catch(err=>{
    console.error('Erro carregando GeoJSON', err)
  })

// Upload helper: read file as data URL and POST to serverless function
document.addEventListener('DOMContentLoaded', ()=>{
  const uploadBtn = document.getElementById('uploadBtn')
  const uploadFile = document.getElementById('uploadFile')
  const uploadStatus = document.getElementById('uploadStatus')
  const btnBasic = document.getElementById('btnBasic')
  const btnSat = document.getElementById('btnSat')
  if (!uploadBtn || !uploadFile) return
  uploadBtn.addEventListener('click', async ()=>{
    const f = uploadFile.files[0]
    if (!f) { uploadStatus.textContent = 'Selecione um arquivo .kmz ou .kml'; return }
    uploadStatus.textContent = 'Preparando arquivo...'
    const reader = new FileReader()
    reader.onload = async function(e){
      try {
        const dataUrl = e.target.result
        // strip prefix like data:application/octet-stream;base64,...
        const base64 = dataUrl.split(',')[1]
        uploadStatus.textContent = 'Enviando ao endpoint...'
        const res = await fetch('/.netlify/functions/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: f.name, content: base64, commitMessage: `Upload ${f.name} via site` })
        })
        const json = await res.json()
        if (res.ok) {
          uploadStatus.textContent = 'Upload concluído — workflow GitHub acionado.'
        } else {
          uploadStatus.textContent = 'Erro: ' + (json.message || res.statusText)
        }
      } catch (err) {
        uploadStatus.textContent = 'Erro no envio: ' + err.message
      }
    }
    reader.readAsDataURL(f)
  })
  // basemap toggle handlers
  if (btnBasic && btnSat) {
    btnBasic.addEventListener('click', ()=>{
      setBasemap('basic')
      btnBasic.style.opacity = '1'
      btnSat.style.opacity = '0.7'
    })
    btnSat.addEventListener('click', ()=>{
      setBasemap('sat')
      btnSat.style.opacity = '1'
      btnBasic.style.opacity = '0.7'
    })
    // initial visual state
    btnBasic.style.opacity = '1'
    btnSat.style.opacity = '0.85'
  }
})

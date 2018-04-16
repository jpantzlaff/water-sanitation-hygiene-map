/* Create a Leaflet map in the "map" div */
let map = L.map('map', {
    /* Render with Canvas rather than the default SVG */
    renderer: L.canvas(),
    /* Restrict zooming to a few zoom levels */
    minZoom: 3,
    maxZoom: 6,
    /* Limit panning to the area of interest */
    maxBounds: [[-35, -19], [56, 155]],
    maxBoundsViscosity: 0.9,
    /* Remove zoom buttons */
    zoomControl: false,
    /* Remove attribution control, as one has been made separately */
    attributionControl: false
});
/* Set the map's initial extent to the 48 continential states */
map.fitBounds([[-35, -19], [56, 155]]);

/* Create the basemap */
let basemap = L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png', {
	subdomains: 'abcd'
});
/* Add the basemap to the map */
basemap.addTo(map);
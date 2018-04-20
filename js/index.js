let colors = {
    drinking: ['#0cf', '#fff'],
    sanitation: ['#2c7', '#fff'],
    handwashing: ['#07f', '#fff'],
    defecation: ['#fff', '#f50'],
    mortality: ['#fff', '#fd0']
};

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
/* Set the map's initial extent to the area of interest */
map.fitBounds([[-35, -19], [56, 155]]);

/* Create the basemap */
let basemap = L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png', {
	subdomains: 'abcd'
});
/* Add the basemap to the map */
basemap.addTo(map);

let countries = L.geoJSON();

$.get({
    url: 'data/countries.topojson',
    dataType: 'json',
    success: function(d) {
        features = topojson.feature(d, d.objects.countries);
        draw();
    }
});

function draw(mode='drinking') {
    countries.clearLayers();
    countries = L.geoJSON(features, {
        /* For each feature in the GeoJSON: */
        style: function(feature) {
            return {
                fillColor: colors[mode][0],
                color: colors[mode][0]
            };
        },
        onEachFeature: function(feature, layer) {
            layer
                .on('click', function() {
                    console.log(feature.properties);
                })
                .on('mouseover', function() {
                    console.log(feature.properties);
                });
        }
    });
    /* Add the countries layer to the map if it isn't added already */
    countries.addTo(map);
}
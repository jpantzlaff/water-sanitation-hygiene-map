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
let active = L.geoJSON();

$.get({
    url: 'data/combined.topojson',
    dataType: 'json',
    success: function(d) {
        countryData = topojson.feature(d, d.objects.countries);
        regionData = topojson.feature(d, d.objects.regions);
        drawCountries();
    }
});

function drawCountries(mode='drinking') {
    countries.clearLayers();
    countries = L.geoJSON(countryData, {
        /* For each feature in the GeoJSON: */
        style: function(feature) {
            return {
                fillColor: colors[mode][0],
                color: colors[mode][0]
            };
        },
        onEachFeature: function(feature, layer) {
            let p = feature.properties;
            layer
                .on('click', function() {
                    console.log(p);
                    drawActive('country', p.name);
                })
                .on('mouseover', function() {
                    console.log(p);
                });
        }
    });
    /* Add the countries layer to the map if it isn't added already */
    countries.addTo(map);
}

function drawActive(type, name) {
    active.clearLayers();
    active = L.geoJSON(window[type + 'Data'], {
        filter: function(feature) {
            return feature.properties.name === name;
        }
    });
    active.addTo(map);
    map.fitBounds(active.getBounds());
}

$('#region-select').on('change', function() {
    drawActive('region', $(this).val());
    $(this).val('Go to a region...');
});
let themes = {
    drinking: {
        title: 'Basic and safely managed drinking water services',
        suffix: '%',
        stat: 'of population has access',
        colors: ['#0cf', '#ccc'],
    },
    sanitation: {
        title: 'Basic and safely managed sanitation services',
        suffix: '%',
        stat: 'of population has access',
        colors: ['#2c7', '#ccc']
    },
    handwashing: {
        title: 'Handwashing with soap',
        suffix: '%',
        stat: 'of population practices',
        colors: ['#07f', '#ccc']
    },
    defecation: {
        title: 'Open defecation',
        suffix: '%',
        stat: 'of population practices',
        colors: ['#ccc', '#f50']
    },
    mortality: {
        title: 'Mortality attributed to unsafe wash services',
        suffix: '',
        stat: 'deaths per 100,000 people',
        colors: ['#ccc', '#fd0']
    }
};

/* Create a Leaflet map in the "map" div */
let map = L.map('map', {
    /* Render with Canvas rather than the default SVG */
    renderer: L.canvas(),
    /* Restrict zooming to a few zoom levels */
    minZoom: 3,
    maxZoom: 6,
    /* Limit panning to the area of interest */
    maxBounds: [[-35, -30], [56, 155]],
    maxBoundsViscosity: 0.9,
    /* Remove zoom buttons */
    zoomControl: false,
    /* Remove attribution control, as one has been made separately */
    attributionControl: false
});
/* Set the map's initial extent to the area of interest */
map.fitBounds([[-35, -30], [56, 155]]);

/* Create the basemap */
let basemap = L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_nolabels/{z}/{x}/{y}.png', {
	subdomains: 'abcd'
});
/* Add the basemap to the map */
basemap.addTo(map);

map.createPane('labels');
map.getPane('labels').style.zIndex = 450;
map.getPane('labels').style.pointerEvents = 'none';

let labels = L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_only_labels/{z}/{x}/{y}.png', {
	subdomains: 'abcd',
    pane: 'labels'
});
labels.addTo(map);

let countries = L.geoJSON();
let active = L.geoJSON();

$.get({
    url: 'data/combined.topojson',
    dataType: 'json',
    success: function(d) {
        countryData = topojson.feature(d, d.objects.countries);
        $.each(themes, function(theme, v) {
            $('#stats').append(`
                <div>
                    <p>${v.title}</p>
                    <p><data id="${theme}-stat"></data>${v.suffix}</p>
                    <p>${v.stat}</p>
                </div>
            `);
            let values = [];
            countryData.features.forEach(i => values.push(i.properties[theme]));
            v.min = Math.min.apply(null, values);
            v.max = Math.max.apply(null, values);
            v.scale = d3.scaleLinear()
                .domain([v.min, v.max])
                .range(v.colors);
            v.opacity = d3.scaleLinear()
                .domain([v.min, v.max])
                .range([0.6, 0.3]);
        });
        regionData = topojson.feature(d, d.objects.regions);
        drawCountries();
    }
});

function drawCountries(mode='drinking') {
    countries.clearLayers();
    countries = L.geoJSON(countryData, {
        /* For each feature in the GeoJSON: */
        style: function(feature) {
            let p = feature.properties;
            return {
                fillColor: themes[mode].scale(p[mode]),
                fillOpacity: themes[mode].opacity(p[mode]),
                color: '#000',
                weight: 0.2
            };
        },
        onEachFeature: function(feature, layer) {
            let p = feature.properties;
            layer
                .on('click', function() {
                    //console.log(p);
                    drawActive('country', p);
                })
                .on('mouseover', function() {
                    //console.log(p);
                });
        }
    });
    /* Add the countries layer to the map if it isn't added already */
    countries.addTo(map);
}

function drawActive(type, prop) {
    active.clearLayers();
    active = L.geoJSON(window[type + 'Data'], {
        interactive: false,
        filter: feature => feature.properties.name === prop.name,
        style: {
            fill: false,
            color: '#000',
            weight: 3
        }
    });
    active.addTo(map);
    map.fitBounds(active.getBounds());
    if (type === 'country') {
        $.each(themes, function(theme) {
            if (prop[theme] === null) {
                $(`#${theme}-stat`).html('Unknown ');
            } else if (theme === 'mortality') {
                $(`#${theme}-stat`).html(prop[theme].toFixed(1));
            } else {
                $(`#${theme}-stat`).html(prop[theme]);
            }
        });
    }
    $('#info').show();
}

$('#region-select').on('change', function() {
    drawActive('region', $(this).val());
    $(this).val('Go to a region...');
});
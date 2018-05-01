let themes = {
    drinking: {
        title: 'Basic and safely managed drinking water services',
        suffix: '%',
        stat: 'of population has access',
        chartStat: 'Population with access',
        colors: ['#0cf', '#ccc'],
    },
    sanitation: {
        title: 'Basic and safely managed sanitation services',
        suffix: '%',
        stat: 'of population has access',
        chartStat: 'Population with access',
        colors: ['#2c7', '#ccc']
    },
    handwashing: {
        title: 'Handwashing with soap',
        suffix: '%',
        stat: 'of population practices',
        chartStat: 'Practicing population',
        colors: ['#07f', '#ccc']
    },
    defecation: {
        title: 'Open defecation',
        suffix: '%',
        stat: 'of population practices',
        chartStat: 'Practicing population',
        colors: ['#ccc', '#f50']
    },
    mortality: {
        title: 'Mortality attributed to unsafe WASH services',
        suffix: '',
        stat: 'deaths per 100,000 people',
        chartStat: 'Deaths per 100,000 people',
        colors: ['#ccc', '#fd0']
    }
};

let contextStats = {
    region: {
        title: 'Region',
        regional: false
    },
    gdp: {
        title: 'Gross Domestic Product',
        regional: 'sum'
    },
    gni: {
        title: 'Gross National Income',
        regional: 'mean'
    },
    fsi: {
        title: 'Fragile States Index',
        regional: 'mean'
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

/* Create the basemap and add to map */
L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_nolabels/{z}/{x}/{y}.png', {
	subdomains: 'abcd'
}).addTo(map);

map.createPane('labels');
map.getPane('labels').style.zIndex = 450;
map.getPane('labels').style.pointerEvents = 'none';

L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_only_labels/{z}/{x}/{y}.png', {
	subdomains: 'abcd',
    pane: 'labels'
}).addTo(map);

L.control.attribution({
    position: 'bottomright',
    prefix: `<a href="http://leafletjs.com">Leaflet</a> | Basemap: &copy;&nbsp;<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy;&nbsp;<a href="https://carto.com/attribution/">CARTO</a> | Countries: <a href="http://www.naturalearthdata.com/">Natural Earth</a> | Economic Indicators: <a href="http://www.worldbank.org/">The World Bank</a> | Fragile States Index: <a href="http://global.fundforpeace.org/index.php">Fund for Peace</a> | WASH Data: <a href="http://www.who.int/">World Health Organization</a> | <a href="#" onclick="$('#credits').show()">Full Credits</a>`
}).addTo(map);

let countries = L.geoJSON();
let active = L.geoJSON();

$.get({
    url: 'data/combined.topojson',
    dataType: 'json',
    success: function(d) {
        countryData = topojson.feature(d, d.objects.countries);
        $.each(contextStats, function(stat, v) {
            $('#context').append(`
                <div class="${(!!v.regional ? 'region country stat' : 'country stat')}">
                    <p>${v.title}</p>
                    <p class="${(!!v.regional ? 'region stat' : 'stat')}">(${v.regional})</p>
                    <p id="${stat}-stat"></p>
                </div>
            `);
        });
        $.each(themes, function(theme, v) {
            $('#country-stats').append(`
                <div>
                    <p>${v.title}</p>
                    <p id="${theme}-stat"></p>
                    <p>${v.stat}</p>
                </div>
            `);
            $('#region-stats').append(`
                <div>
                    <p>${v.title}</p>
                    <div id="${theme}-list"></div>
                </div>
            `);
            let values = [];
            countryData.features.forEach(i => values.push(i.properties[theme]));
            v.min = Math.min(...values);
            v.max = Math.max(...values);
            v.scale = d3.scaleLinear()
                .domain([v.min, v.max])
                .range(v.colors);
            v.opacity = d3.scaleLinear()
                .domain([v.min, v.max])
                .range([0.75, 0.6]);
            v.height = d3.scaleLinear()
                .domain([v.min, v.max])
                .range([2, 100]);
            
            $('#charts').append(`
                <div id="${theme}-chart" class="chart-tile" onclick="drawCountries('${theme}', 'click')" onmouseover="drawCountries('${theme}', 'mouseover')" onmouseout="drawCountries('${theme}', 'mouseout')">
                    <p class="chart-title">${themes[theme].title}</p>
                    <div class="chart-labels">
                        <p>${formatStat(v.min, theme)}</p>
                        <p>${v.chartStat}</p>
                        <p>${formatStat(v.max, theme)}</p>
                    </div>
                </div>
            `);
            
            let chart = d3.select(`#${theme}-chart`)
                /* Append a div element to hold bars */
                .insert('div', ':nth-child(2)')
                /* Make the element part of the "chart" class */
                .attr('class', 'chart');

            /* Make a selection to begin inserting bars */
            let bars = chart.selectAll('.bars')
                /* Set the data source as the country data object */
                .data(countryData.features)
                /* Recurse through the object */
                .enter()
                .filter(d => d.properties[theme] !== null)
                /* Append a div for each bar */
                .append('div')
                /* Sort the bars by value */
                .sort((a, b) => a.properties[theme] - b.properties[theme])
                /* Set class names for the bars; all are in "bar", and each bar is also added to a class based on its value */
                .attr('class', d => 'bar ' + d.properties.abbr)
                /* Set the fill color using the same scales as the map */
                .style('background-color', d => themes[theme].scale(d.properties[theme]))
                /* Set the height of each bar using its value, scaled between 0 and 100 */
                .style('height', d => themes[theme].height(d.properties[theme]) + 'px')
                .on('click', makeActiveD3)
                .on('mouseover', makeActiveD3)
                .on('mouseout', makeActiveD3);
        });
        regionData = topojson.feature(d, d.objects.regions);
        
        for (i = 0; i < regionData.features.length; i++) {
            let rProp = regionData.features[i].properties;
            
            $.each(themes, (i, v) => v[rProp.name] = {});
            
            ['gdp', 'gni', 'fsi', 'countries'].forEach(p => rProp[p] = []);
            countryData.features.forEach(c => {
                let cProp = c.properties;
                if (cProp.region === rProp.name) {
                    rProp.gdp.push(cProp.gdp);
                    rProp.gni.push(cProp.gni);
                    rProp.fsi.push(cProp.fsi);
                    rProp.countries.push(cProp.abbr);
                             
                    $.each(themes, (i, v) => {
                        themes[i][rProp.name][cProp.name] = cProp[i];
                    });
                }
            });
            rProp.gdp = arrayStat(rProp.gdp, 'sum');
            rProp.gni = arrayStat(rProp.gni, 'mean');
            rProp.fsi = arrayStat(rProp.fsi, 'mean');
        }
        drawCountries('drinking');
        $('body').css('visibility', 'visible');
    }
});

function arrayStat(array, stat) {
    let sum = 0;
    array.forEach(v => sum += v);
    if (stat === 'sum') return sum;
    else if (stat === 'mean') return sum / array.length;
}

function drawCountries(mode, event='click') {
    currentMode = mode;
    if (event === 'click') activeMode = mode;
    else if (event === 'mouseout') mode = activeMode;
    $('.chart-tile').removeClass('active');
    $(`#${mode}-chart`).addClass('active');
    countries.clearLayers();
    countries = L.geoJSON(countryData, {
        /* For each feature in the GeoJSON: */
        style: function(feature) {
            let p = feature.properties;
            return {
                fillColor: (p[mode] !== null ? themes[mode].scale(p[mode]) : 'white'),
                fillOpacity: themes[mode].opacity(p[mode]),
                color: '#000',
                weight: 0.2
            };
        },
        onEachFeature: function(feature, layer) {
            let p = feature.properties;
            layer
                .on('click', function() {
                    makeActive('country', p, 'click');
                })
                .on('mouseover', function() {
                    makeActive('country', p, 'mouseover');
                })
                .on('mouseout', function() {
                    makeActive('country', p, 'mouseout');
                })
                .bindTooltip(`
                    <p>${p.name}</p>
                    <p>${themes[mode].title}</p>
                    <div style="display:flex">
                        <p>${formatStat(p[mode], mode)}</p>
                        <p>${themes[mode].stat}</p>
                    </div>
                `, {
                    sticky: true
                });
        }
    });
    /* Add the countries layer to the map if it isn't added already */
    countries.addTo(map);
}

function formatStat(stat, theme) {
    if (stat === null) return 'Unknown ' + themes[theme].suffix;
    else if (theme === 'mortality') return stat.toFixed(1);
    else return stat + themes[theme].suffix;
}

function formatCurrency(v, precision) {
    if (v === null) return 'Unknown';
    let styled = Math.round(v).toLocaleString('en-US');
    let first = '$' + Number(styled.slice(0, precision + 1).replace(',', '.'));
    let commas = (styled.match(/,/g) || []).length;
    if (commas === 4) return first + 'T';
    else if (commas === 3) return first + 'B';
    else if (commas === 2) return first + 'M';
    else if (commas === 1) return first + 'K';
    else return '$' + styled;
}

function makeActiveD3(d) {
    let event = d3.event;
    makeActive('country', d.properties, event.type);
    let p = themes[currentMode];
    if (event.type === 'mouseover') {
        $('#chart-tooltip')
            .html(`
                <div class="leaflet-tooltip">
                    <p>${d.properties.name}</p>
                    <p>${p.title}</p>
                    <div style="display:flex">
                        <p>${formatStat(d.properties[currentMode], currentMode)}</p>
                        <p>${p.stat}</p>
                    </div>
                </div>
            `)
            .css('visibility', 'visible')
            .css('top', (event.pageY - 30) + 'px')
            .css('left', (event.pageX + 10) + 'px');
    } else if (event.type === 'mouseout') {
        $('#chart-tooltip').css('visibility', 'hidden');
    }
}

let activeFeature = null;

function getRegionProp(name) {
    for (i = 0; i < regionData.features.length; i++) {
        if (regionData.features[i].properties.name === name) return regionData.features[i].properties;
    }
}

function makeActive(type, prop, event) {
    if (type === 'region') prop = getRegionProp(prop);
    if (event === 'mouseout') {
        if (!!activeFeature) {
            type = activeFeature.type;
            prop = activeFeature.prop;
        } else {
            removeActive();
            return;
        }
    }
    active.clearLayers();
    $('.bar').addClass('inactive');
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
    $('#info-title').html(prop.name);
    $('.stat').hide();
    $('.stat.' + type).show();
    if (type === 'country') {
        $('.' + prop.abbr).removeClass('inactive');
        $.each(themes, theme => $(`#${theme}-stat`).html(formatStat(prop[theme], theme)));
    } else if (type === 'region') {
        prop.countries.forEach(abbr => $('.' + abbr).removeClass('inactive'));
        $.each(themes, theme => {
            $(`#${theme}-list`).html(null);
            $.each(themes[theme][prop.name], (i, v) => {
                $(`#${theme}-list`).append(`
                    <div class="region-list-entry">
                        <p>${i}</p>
                        <p>${formatStat(v, theme).replace('Unknown %', '-')}</p>
                    </div>
                `);
            });
        });
    }
    $.each(contextStats, stat => {
        if (stat === 'region') $(`#${stat}-stat`).html(prop[stat]);
        else if (stat === 'fsi') $(`#${stat}-stat`).html(prop[stat].toFixed(1));
        else $(`#${stat}-stat`).html(formatCurrency(prop[stat], 3));
    });
    if (event === 'click') {
        activeFeature = {
            type: type,
            prop: prop
        };
        map.fitBounds(active.getBounds());
        $('#info').show();
    }
    map.invalidateSize();
}

$('#region-select').on('change', function() {
    makeActive('region', $(this).val(), 'click');
    $(this).val('Go to a region...');
});

function removeActive() {
    activeFeature = null;
    active.clearLayers();
    $('.inactive').removeClass('inactive');
    $('#info').hide();
    map.invalidateSize();
}

$('#close').on('click', function() {
    removeActive();
});
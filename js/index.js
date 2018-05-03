/* List of possible themes (display modes), including text and color ramps to display */
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

/* List of statistics provided for context in the info box (bottom panel) */
let contextStats = {
    region: {
        title: 'Region',
        /* This statistic should not be displayed at all when a region is the active feature */
        regional: false
    },
    gdp: {
        title: 'Gross Domestic Product',
        /* When the active feature is a region, a sum of all of the values of its constituent countries should be displayed */
        regional: 'sum'
    },
    gni: {
        title: 'Gross National Income',
        /* When the active feature is a region, the mean of all of the values of its constituent countries should be displayed */
        regional: 'mean'
    },
    fsi: {
        title: 'Fragile States Index',
        regional: 'mean'
    }
};

/* Initialize the application with no feature being active */
let activeFeature = null;

/* Create a Leaflet map in the "map" div */
let map = L.map('map', {
    /* Render with Canvas rather than the default SVG */
    renderer: L.canvas(),
    /* Restrict zooming to a few zoom levels */
    minZoom: 3,
    maxZoom: 6,
    /* Limit panning to the area of interest */
    maxBounds: [[-38, -30], [56, 155]],
    maxBoundsViscosity: 0.9,
    /* Remove zoom buttons */
    zoomControl: false,
    /* Remove default attribution control, as one has been made separately */
    attributionControl: false
});
/* Set the map's initial extent to the area of interest */
map.fitBounds([[-38, -30], [56, 155]]);

/* Create the basemap layer and add to map */
L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_nolabels/{z}/{x}/{y}.png', {
	subdomains: 'abcd'
}).addTo(map);

/* Create a map pane to hold labels, as these should display above everything else on the map */
map.createPane('labels');
/* Set a z-index that will achieve the intended result: above everything but the tooltip */
map.getPane('labels').style.zIndex = 450;
/* Don't capture any pointer events in this labels pane, allowing pointer interactions to make it "down" to the country features */
map.getPane('labels').style.pointerEvents = 'none';

/* Create the labels layer and add to the map - specifically, the labels pane */
L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_only_labels/{z}/{x}/{y}.png', {
	subdomains: 'abcd',
    pane: 'labels'
}).addTo(map);

/* Create an attribution control containing all of the attribution for the various data sources and add to the map */
L.control.attribution({
    position: 'bottomright',
    prefix: `<a href="http://leafletjs.com">Leaflet</a> | Basemap: &copy;&nbsp;<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy;&nbsp;<a href="https://carto.com/attribution/">CARTO</a> | Countries: <a href="http://www.naturalearthdata.com/">Natural Earth</a> | Economic Indicators: <a href="http://www.worldbank.org/">The World Bank</a> | Fragile States Index: <a href="http://global.fundforpeace.org/index.php">Fund for Peace</a> | WASH Data: <a href="http://www.who.int/">World Health Organization</a> | <a href="#" onclick="$('#credits').show()">Full Credits</a>`
}).addTo(map);

/* Create empty GeoJSON-based layers to store the country features and the active feature */
let countries = L.geoJSON();
let active = L.geoJSON();

/* Request the TopoJSON data containing the country and region features via AJAX */
$.get({
    url: 'data/combined.topojson',
    /* Expect JSON in response */
    dataType: 'json',
    /* When the response is received: */
    success: function(d) {
        /* Assign the countries portion of the TopoJSON to a global variable */
        countryData = topojson.feature(d, d.objects.countries);
        /* For each contextual statistic: */
        $.each(contextStats, function(stat, v) {
            /* Add elements to the document that are ready to display the contextual information; elements in the "region" class display only when a region is the active feature, while those in "country" only appear when a country is active */
            $('#context').append(`
                <div class="${(!!v.regional ? 'region country stat' : 'country stat')}">
                    <p>${v.title}</p>
                    <p class="${(!!v.regional ? 'region stat' : 'stat')}">(${v.regional})</p>
                    <p id="${stat}-stat"></p>
                </div>
            `);
        });
        /* For each theme: */
        $.each(themes, function(theme, v) {
            /* Repeat much of the same as line 124, creating places in the document to display the information as it's requested */
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
                    <p>${v.chartStat}</p>
                    <div id="${theme}-list"></div>
                </div>
            `);
            /* SCALE CREATION */
            /* Create an empty array to hold of the attribute values for this theme */
            let values = [];
            /* Push the values into the array */
            countryData.features.forEach(i => values.push(i.properties[theme]));
            /* Calculate the minimum value present */
            v.min = Math.min(...values);
            /* Calculate the maximum value present */
            v.max = Math.max(...values);
            /* Using the min/max values and this theme's color ramp, create a scale that's used to color the charts and country features */
            v.scale = d3.scaleLinear()
                .domain([v.min, v.max])
                .range(v.colors);
            /* Do the same for opacity - more saturated colors will be made more opaque to accentuate areas in need */
            v.opacity = d3.scaleLinear()
                .domain([v.min, v.max])
                .range([0.75, 0.75]);
            /* Create another scale to determine the height of the bars in the chart */
            v.height = d3.scaleLinear()
                .domain([v.min, v.max])
                .range([2, 100]);
            
            /* Append an empty chart to the side panel, along with the relevant title, min/max values, and X-axis label */
            $('#charts').append(`
                <div id="${theme}-chart" class="chart-tile" onclick="drawCountries('${theme}', 'click')" onmouseover="drawCountries('${theme}', 'mouseover')" onmouseout="drawCountries('${theme}', 'mouseout')">
                    <p class="chart-title">${themes[theme].title}</p>
                    <div class="chart-parent">
                        <div class="chart"></div>
                    </div>
                    <div class="chart-labels">
                        <p>${formatStat(v.min, theme)}</p>
                        <p>${v.chartStat}</p>
                        <p>${formatStat(v.max, theme)}</p>
                    </div>
                </div>
            `);
            
            let chart = d3.select(`#${theme}-chart .chart`);

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
                .style('height', d => themes[theme].height(d.properties[theme]) + '%')
                .on('click', makeActiveD3)
                .on('mouseover', makeActiveD3)
                .on('mouseout', makeActiveD3);
        });
        /* Assign the regions portion of the TopoJSON to a global variable */
        regionData = topojson.feature(d, d.objects.regions);
        
        for (i = 0; i < regionData.features.length; i++) {
            let rProp = regionData.features[i].properties;
            $.each(themes, (i, v) => v[rProp.name] = []);
            ['gdp', 'gni', 'fsi', 'countries'].forEach(p => rProp[p] = []);
            countryData.features.forEach(c => {
                let cProp = c.properties;
                if (cProp.region === rProp.name) {
                    rProp.gdp.push(cProp.gdp);
                    rProp.gni.push(cProp.gni);
                    rProp.fsi.push(cProp.fsi);
                    rProp.countries.push(cProp.abbr);       
                    $.each(themes, i => themes[i][rProp.name].push([cProp.name, cProp[i]]));
                }
            });
            $.each(themes, (theme, v) => {
                if (theme === 'defecation' || theme === 'mortality') v[rProp.name] = sortInArray(v[rProp.name], true);
                else v[rProp.name] = sortInArray(v[rProp.name], false);
            });
            rProp.gdp = arrayStat(rProp.gdp, 'sum');
            rProp.gni = arrayStat(rProp.gni, 'mean');
            rProp.fsi = arrayStat(rProp.fsi, 'mean');
        }
        drawCountries('drinking');
        $('body').css('visibility', 'visible');
    }
});

function sortInArray(arr, invert) {
    let iLength = arr.length;
    let arrReturn = [];
    let keys = [];
    let values = [];
    arr.forEach(i => {
        keys.push(i[0]);
        values.push(i[1]);
    });
    let valuesCopy = [...values];
    let sorted = valuesCopy.sort(invert ? (a, b) => b - a : (a, b) => a - b);
    sorted.forEach(i => {
        let index = values.indexOf(i);
        arrReturn.push([keys[index], values[index]]);
        keys.splice(index, 1);
        values.splice(index, 1);
    });
    return arrReturn;
}

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

function getProp(name, type) {
    for (i = 0; i < window[type + 'Data'].features.length; i++) {
        if (window[type + 'Data'].features[i].properties.name === name) return window[type + 'Data'].features[i].properties;
    }
}

function makeActive(type, prop, event) {
    if (typeof prop === 'string') prop = getProp(prop, type);
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
                    <div class="region-list-entry" onclick="makeActive('country', '${v[0]}', 'click')">
                        <p>${v[0]}</p>
                        <p>${formatStat(v[1], theme).replace('Unknown', '&mdash;').replace(' %', '')}</p>
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
        $('#info').show();
        map.invalidateSize();
        activeFeature = {
            type: type,
            prop: prop
        };
        map.fitBounds(active.getBounds());
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
/* global AmCharts, moment */
var poi
$(function () {
    poi = utils.getPoiValue()
    poi.davraUrl = ''
    poi.davraMs = ''
    if (window.location.hostname === 'localhost') {
        var davraToken = localStorage.getItem('davraToken')
        $.ajaxSetup({ headers: { Authorization: 'Bearer ' + davraToken } })
        // poi.davraUrl = 'https://pif.davra.com'
        poi.davraUrl = 'https://platform.pif-stc.davra.com'
    }
    else {
        poi.davraMs = '/microservices/wrld3d'
    }
    var type = (poi && poi.user_data.title.substr(poi.user_data.title.length - 1)) || '1'
    $('.address-icon.finger i').addClass('fas fa-times')
    $('.address-icon.face i').addClass('fas fa-times')
    $('.address-icon.wifi i').addClass('fas fa-times')
    $('.address-icon.display i').addClass('fas fa-times')
    $('.address-icon.keypad i').addClass('fas fa-times')
    var deviceId = ''
    // twitter account is the deviceId
    if (window.location.hostname !== 'pif.davra.com' && poi && poi.user_data.twitter) deviceId = poi.user_data.twitter
    if (deviceId) {
        $.get(poi.davraMs + '/door/capability/' + encodeURIComponent(deviceId), function (result) {
            if (!result.success) {
                console.error('Door capability failed: ' + result.message)
            }
            else {
                console.log('Door capability', result.data)
                if (result.data.finger) $('.address-icon.finger i').removeClass('fa-times').addClass('fa-check')
                if (result.data.face) $('.address-icon.face i').removeClass('fa-times').addClass('fa-check')
                if (result.data.display) $('.address-icon.display i').removeClass('fa-times').addClass('fa-check')
                if (result.data.keypad) $('.address-icon.keypad i').removeClass('fa-times').addClass('fa-check')
            }
        })
        $.get(poi.davraMs + '/door/status/' + encodeURIComponent(deviceId), function (result) {
            if (result.success) {
                console.log('Door status', result.status)
                if (result.status) {
                    $('.meeting-room-details .status span').removeClass('offline').addClass('online')
                    $('.meeting-room-details .status span').text('ONLINE')
                }
                else {
                    $('.meeting-room-details .status span').removeClass('online').addClass('offline')
                    $('.meeting-room-details .status span').text('OFFLINE')
                }
            }
        })
        // facebook account is the device type
        type = poi.user_data.facebook
        if (type === '1') $('.meeting-room-photo img')[0].src = '/microservices/wrld3d/img/FaceStationF2.jpg'
        else if (type === '2') $('.meeting-room-photo img')[0].src = '/microservices/wrld3d/img/FaceLite.png'
        else $('.meeting-room-photo img')[0].src = '/microservices/wrld3d/img/FaceStationF2.jpg'
    }
    else if (type === '1') {
        $('.meeting-room-photo img')[0].src = '/microservices/wrld3d/img/FaceStationF2.jpg'
        $('.address-icon.finger i').removeClass('fa-times').addClass('fa-check')
        $('.address-icon.face i').removeClass('fa-times').addClass('fa-check')
        $('.address-icon.display i').removeClass('fa-times').addClass('fa-check')
        $('.address-icon.keypad i').removeClass('fa-times').addClass('fa-check')
    }
    else if (type === '2') {
        $('.meeting-room-photo img')[0].src = '/microservices/wrld3d/img/FaceLite.png'
        $('.address-icon.finger i').removeClass('fa-times').addClass('fa-check')
        $('.address-icon.face i').removeClass('fa-times').addClass('fa-check')
        $('.address-icon.display i').removeClass('fa-times').addClass('fa-check')
    }
    else {
        $('.meeting-room-photo img')[0].src = '/microservices/wrld3d/img/SpeedBlade.png'
    }
    doOccupancy(deviceId)
    doUptime(deviceId)
    doIncidents(deviceId)
    digsig.doAnomaly(deviceId)
})
function doOccupancy (deviceId) {
    var dataset = []
    if (deviceId) {
        var oneYearAgo = new Date(); oneYearAgo.setDate(oneYearAgo.getDate() - (52 * 7)); oneYearAgo = oneYearAgo.getTime()
        var installDate = new Date(2021, 6, 4).getTime()
        if (installDate > oneYearAgo) oneYearAgo = installDate
        var numberOfWeeks = Math.floor((new Date().getTime() - oneYearAgo) / (7 * 24 * 60 * 60 * 1000)) || 1
        var data = {
            metrics: [{
                name: 'door.access',
                limit: 100000,
                tags: {
                    serialNumber: deviceId
                },
                aggregators: [{
                    name: 'sum',
                    align_sampling: true,
                    sampling: {
                        value: '1',
                        unit: 'hours'
                    }
                }]
            }],
            start_absolute: oneYearAgo
        }
        $.post(poi.davraUrl + '/api/v2/timeseriesData', JSON.stringify(data), function (result) {
            console.log(result)
            var values = result.queries[0].results[0].values
            var day, hour, datapoint
            var datapoints = {}
            for (day = 0; day < 5; day++) {
                for (hour = 6; hour < 19; hour++) {
                    datapoint = { day: day + 1, hour: hour - 5, count: 0, value: 0 }
                    dataset.push(datapoint)
                    datapoints[day + '.' + hour] = datapoint
                }
            }
            // var min = 0
            // var max = 0
            var i, n
            for (i = 0, n = values.length; i < n; i++) {
                var value = values[i]
                var date = new Date(value[0])
                var count = value[1]
                day = date.getUTCDay()
                hour = date.getUTCHours() + 3 // Riyadh is always UTC + 3 with no daylight savings
                if (day === 5 || day === 6) continue // skip Friday/Saturday
                if (hour < 6 || hour >= 19) continue // skip non-office hours (Saudi time)
                datapoints[day + '.' + hour].count += count
                // if (min === 0) min = count
                // if (min > count) min = count
                // if (max < count) max = count
            }
            // var spread = max - min
            // if (spread > 0) {
            for (i = 0, n = dataset.length; i < n; i++) {
                datapoint = dataset[i]
                // datapoint.value = (datapoint.count - min) * 100 / spread
                datapoint.value = datapoint.count / numberOfWeeks
            }
            // }
            utils.chartOccupancyQuantile(dataset)
        })
    }
    else { // mockup data
        for (var tmpDay = 1; tmpDay < 6; tmpDay++) {
            for (var tmpHour = 1; tmpHour < 14; tmpHour++) {
                var tmpDatapoint = {}
                tmpDatapoint.day = tmpDay
                tmpDatapoint.hour = tmpHour
                // weighted to the morning, lunch and evening rush hours
                if (tmpHour === 3 || tmpHour === 7 || tmpHour === 12) {
                    tmpDatapoint.value = 50 + parseInt(Math.random() * 50)
                }
                else {
                    tmpDatapoint.value = 0 + parseInt(Math.random() * 10)
                }
                dataset.push(tmpDatapoint)
            }
        }
        utils.chartOccupancyQuantile(dataset)
    }
}
function doIncidents (deviceId) {
    var data = []
    var tableColumns = [
        {
            title: 'Time',
            data: 'timestamp',
            render: function (value, type, record) {
                return '<span style="display: none">' + value + '</span>' + moment(value).format('YYYY-MM-DD HH:mm')
            },
            width: '50%'
        },
        // {
        //     title: 'Type',
        //     data: 'description',
        //     width: '30%'
        // },
        {
            title: 'Duration',
            data: 'duration',
            render: function (value, type, record) {
                return value ? ('<span style="display: none">' + ('' + value).padStart(12, '0') + '</span>' + utils.formatDuration(value)) : ''
            },
            width: '50%'
        }
    ]
    if (deviceId) {
        var endDate = new Date().getTime()
        var query = {
            metrics: [{
                name: 'door.outage',
                limit: 100000,
                tags: {
                    serialNumber: deviceId
                }
            // },
            // {
            //     name: 'davra.digitalSignatures.Door',
            //     limit: 100000,
            //     tags: {
            //         serialNumber: deviceId
            //     }
            }],
            start_absolute: endDate - (60 * 24 * 60 * 60 * 1000),
            end_absolute: endDate
        }
        $.post(poi.davraUrl + '/api/v2/timeseriesData', JSON.stringify(query), function (result) {
            console.log(result)
            var values1 = result.queries[0].results[0].values
            data = []
            var i, n, value
            for (i = 0, n = values1.length; i < n; i++) {
                value = values1[i]
                data.push({ timestamp: value[0], description: 'Contact lost', duration: value[1] })
            }
            initTable('#table', tableColumns, data)
        })
    }
    else { // mockup data
        data = [
            { timestamp: 1624312564770, description: 'Contact lost', duration: 170440000, userId: 'ABC123' },
            { timestamp: 1624208954770, description: 'Contact lost', duration: 11000, userId: 'D45678' },
            { timestamp: 1624305344770, description: 'Contact lost', duration: 33000, userId: 'X566489' },
            { timestamp: 1624101734770, description: 'Contact lost', duration: 22000, userId: 'AYS5412' }
        ]
        initTable('#table', tableColumns, data)
    }
}
function doUptime (deviceId) {
    if (deviceId) {
        var now = new Date().getTime()
        var oneDayAgo = new Date(); oneDayAgo.setDate(oneDayAgo.getDate() - 1); oneDayAgo = oneDayAgo.getTime()
        var oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7); oneWeekAgo = oneWeekAgo.getTime()
        var oneMonthAgo = new Date(); oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1); oneMonthAgo = oneMonthAgo.getTime()
        var oneYearAgo = new Date(); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1); oneYearAgo = oneYearAgo.getTime()
        var installDate = new Date(2021, 6, 4).getTime()
        if (installDate > oneYearAgo) oneYearAgo = installDate
        var data = {
            metrics: [
                {
                    name: 'door.outage.timeslice',
                    limit: 100000,
                    tags: {
                        serialNumber: deviceId
                    },
                    aggregators: [{
                        name: 'sum',
                        sampling: {
                            value: '1',
                            unit: 'days'
                        }
                    }]
                }
            ],
            start_absolute: oneYearAgo
        }
        $.post(poi.davraUrl + '/api/v2/timeseriesData', JSON.stringify(data), function (result) {
            console.log(result)
            var values = result.queries[0].results[0].values || []
            var value1 = 0
            var value2 = 0
            var value3 = 0
            var value4 = 0
            for (var i = values.length - 1; i >= 0; i--) {
                var date = values[i][0]
                var value = values[i][1]
                if (date >= oneDayAgo) value1 += value
                if (date >= oneWeekAgo) value2 += value
                if (date >= oneMonthAgo) value3 += value
                if (date >= oneYearAgo) value4 += value
            }
            var perc1 = utils.roundTo2((value1 * 100) / (now - oneDayAgo))
            var perc2 = utils.roundTo2((value2 * 100) / (now - oneWeekAgo))
            var perc3 = utils.roundTo2((value3 * 100) / (now - oneMonthAgo))
            var perc4 = utils.roundTo2((value4 * 100) / (now - oneYearAgo))
            chartUptimeConfig.dataProvider[0].uptime = utils.roundTo2(100 - perc1)
            chartUptimeConfig.dataProvider[1].uptime = utils.roundTo2(100 - perc2)
            chartUptimeConfig.dataProvider[2].uptime = utils.roundTo2(100 - perc3)
            chartUptimeConfig.dataProvider[3].uptime = utils.roundTo2(100 - perc4)
            chartUptimeConfig.dataProvider[0].downtime = perc1
            chartUptimeConfig.dataProvider[1].downtime = perc2
            chartUptimeConfig.dataProvider[2].downtime = perc3
            chartUptimeConfig.dataProvider[3].downtime = perc4
            AmCharts.makeChart('chartUptime', chartUptimeConfig)
        })
    }
    else { // mockup data
        AmCharts.makeChart('chartUptime', chartUptimeConfig)
    }
    var width = $(window).width() * 0.98
    var height = $(window).height() * 0.98
    $('#chartUptime').width(width).height(height)
}
function initTable (tableId, tableColumns, data) {
    var dataTableConfig = {
        dom: 'Bfrtip',
        bDestroy: true,
        pageLength: 8,
        pagingType: 'simple',
        info: true,
        paging: true,
        select: false,
        columns: tableColumns,
        autoWidth: false,
        order: [[0, 'desc']],
        language: {
            paginate: { previous: '<', next: '>' }
        }
    }
    $(tableId).DataTable(dataTableConfig)
    $(tableId).dataTable().fnClearTable()
    if (data.length) $(tableId).dataTable().fnAddData(data)
}
var chartUptimeConfig = {
    type: 'serial',
    theme: 'light',
    legend: {
        horizontalGap: 10,
        verticalGap: 3,
        maxColumns: 2,
        position: 'top',
        useGraphSettings: true,
        markerSize: 10
    },
    fillColors: ['green', 'red'],
    dataProvider: [
        { year: 'Last day', uptime: 99.0, downtime: 1.0 },
        { year: 'Last week', uptime: 99.9, downtime: 0.1 },
        { year: 'Last month', uptime: 97.5, downtime: 2.5 },
        { year: 'Last year', uptime: 99.9, downtime: 0.1 }
    ],
    valueAxes: [{
        stackType: '100%',
        axisAlpha: 0.5,
        gridAlpha: 0
    }],
    graphs: [{
        balloonText: '<b>[[title]]</b><br><span style="font-size:14px">[[category]]: <b>[[value]]%</b></span>',
        fillColors: '#008800',
        fillAlpha: 1,
        // pattern: {
        //     url: 'https://www.amcharts.com/lib/3/patterns/black/pattern8.png',
        //     width: 4,
        //     height: 4
        // },
        fillAlphas: 0.8,
        labelText: '[[value]]',
        lineAlpha: 0.3,
        title: 'Uptime',
        type: 'column',
        color: '#000000',
        valueField: 'uptime'
    }, {
        balloonText: '<b>[[title]]</b><br><span style="font-size:14px">[[category]]: <b>[[value]]%</b></span>',
        fillColors: '#ff0000',
        fillAlpha: 1,
        fillAlphas: 0.8,
        labelText: '[[value]]',
        lineAlpha: 0.3,
        title: 'Downtime',
        type: 'column',
        color: '#000000',
        valueField: 'downtime'
    }],
    rotate: true,
    categoryField: 'year',
    categoryAxis: {
        gridPosition: 'start',
        axisAlpha: 0,
        gridAlpha: 0,
        position: 'left'
    },
    export: {
        enabled: true
    }
}

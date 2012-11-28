
var seneca = require('seneca')
var transport_queue = require('..')

var si = seneca({log:'print'})


si.use('echo',{inject:{bar:2}})
si.use( transport_queue )


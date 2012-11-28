
var seneca = require('seneca')
var transport_queue = require('..')

var si = seneca({log:'print'})

si.use(transport_queue,{
  pins: [
    { role:'echo' },
  ] 
})



si.act({role:'echo',foo:111},function(err,res){
  console.log('SENDER ECHO: '+err+JSON.stringify(res))
})


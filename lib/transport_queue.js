/* Copyright (c) 2012 Richard Rodger */

"use strict";

var _     = require('underscore')
var redis = require('redis')
var idgen = require('idgen')


function crop(str,len) {
  str = ''+str
  len = len || 33
  return str.substring(0,Math.max(str.length,len))
}



module.exports = function transport_queue(si,opts,cb) {

  opts = _.extend({
    port:6379,
    host:'127.0.0.1'
  },opts)

  var origin = opts.origin || idgen( opts.originlen || 6 )

  var client_in  = redis.createClient(opts.port,opts.host)
  var client_out = redis.createClient(opts.port,opts.host)

  var in_channel  = 'seneca_in'+(opts.tag$?'_'+opts.tag$:'')
  var out_channel = 'seneca_out'+(opts.tag$?'_'+opts.tag$:'')

  // TODO: make this a proper cache with a TTL
  var call_map = {}


  function publish(channel,msgstr) {
    si.log('publish',channel,crop(msgstr))
    client_out.publish(channel,msgstr)
  }

  function listen(incb,outcb) {
    client_in.on('message',function(channel,msgstr){
      si.log('message',channel,crop(msgstr))

      var data = JSON.parse(msgstr)
      if( in_channel == channel ) {
        if( origin != data.origin$ ) {
          incb(data)
        }
      }
      else if(out_channel == channel ) {
        if( origin != data.origin$ ) {
          outcb(data)
        }
      }
    })
    client_in.subscribe(in_channel)
    client_in.subscribe(out_channel)
  }

  function send(args,cb){
    args.args.origin$ = origin
    var msgstr = JSON.stringify(args.args)
    call_map[args.args.tag$] = cb
    publish(in_channel,msgstr)
  }


  if( opts.pins ) {
    _.each(opts.pins,function(pin){
      si.add(pin,function(args,cb){
        si.act({role:'transport_queue',cmd:'send',args:args},cb)
      })
    })
  } 
  
  
  listen(
    function(args){
      si.log('listen','act',crop(JSON.stringify(args)))
      var orig_tag = args.tag$

      si.act(args,function(err,result){
        result.tag_remote$ = args.tag$
        result.tag$ = orig_tag
        result.origin$ = origin
        var out = {err:err?err.message:null,res:result,tag$:result.tag$,origin$:result.origin$}
        var msgstr = JSON.stringify(out)
        publish(out_channel,msgstr)
      })
    },
    function(data){
      var cb = call_map[data.tag$]

      //console.log('CB '+data.tag$+' '+cb+' '+_.keys(call_map))

      if( cb ) {
        var err = data.err ? new Error(data.err) : null
        delete call_map[data.tag$]

        si.log('listen','res',crop(JSON.stringify(data.res)))
        cb(err,data.res)
      }
      else {
        si.log('listen','unknown-callback',data)
      }
    }
  )


  si.add({role:'transport_queue',cmd:'send'},send)  

  client_in.on('ready',function(){
    si.log('client_in','ready')
  })

  client_out.on('ready',function(){
    si.log('client_out','ready')
  })

  client_out.on('subscribe',function(channel,count){
    si.log('subscribe',channel,count)
  })

  si.log('origin',origin)

  cb()
}

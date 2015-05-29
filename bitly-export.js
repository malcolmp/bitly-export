/**
 * Command line interface Bitly export
 * @file bitly-export.js
 */
function cmd(){
	"use strict";
	var argv = require('optimist')
	    .usage('Usage: $0 <method> -u [username] -p [password] -a [access token] -c [client_id] -s [client secret key] -o [output file]')
	    .demand(['o'])
	    .alias('u','username')
	    .describe('u','Bitly account username')
		.alias('p','password')
		.describe('p','Bitly account password')
	    .alias('c','client_id')
	    .describe('c','Bitly App client id')
		.alias('a','access_token')
		.describe('a','Bitly access_token')
		.alias('s','secret_key')
		.describe('s','Bitly App secret key')
		.alias('o','output_file')
		.describe('o','Output file csv')
	    .argv;
	
	var fs = require("fs"),
		util = require("util"),
		colors = require('colors'),
		stream = require("stream"),
		_ = require('underscore'),
		BitlyAPI = require('node-bitlyapi');

	_.templateSettings = {
		interpolate: /\{\{(.+?)\}\}/g
	};

	var method = _.first(argv._),
		username = argv.u,
		password = argv.p,
		access_token = argv.a,
		client_id = argv.c,
		client_secret = argv.s,
		outputFile = argv.o,
		DEBUG = true;

	var config = {}, needs_auth = true;
	if(client_id && client_secret){
		config = { client_id: username, client_secret: client_secret}
	}
	var Bitly = new BitlyAPI(config);

	var BitlyExport = {
		link_history: [],
		link_history_csv_template: _.template("{{title}},{{link}},{{long_url}},{{aggregate_link}},{{created_at}},{{modified_at}},{{private}}\n"),
		request:{
			link_history: function(){
				function getUserLinkHistory(offset){
					offset = offset || 0;
					Bitly.getUserLinkHistory({
						limit: 100,
						offset: offset
					}, function(error, response){
						response = JSON.parse(response);
						var link_count = response.data.link_history.length;
						BitlyExport.link_history = BitlyExport.link_history.concat(response.data.link_history);
						//while response length >=100
						//if(DEBUG){ console.log(util.inspect(BitlyExport.link_history[0], {colors: true})); }
						if(link_count === 100){
							//### Request more links
							//it's a callback so recursion overhead is minimal, right?
							getUserLinkHistory(offset + 100);
						}else{
							if(DEBUG){ console.log("DONE requesting link history. " + response.data.result_count.toString() + " total links"); }
							buildCSV();
						}
					});
				}

				function buildCSV(){
					var csv = "title,link,long_url,aggregate_link,created_at,modified_at,private\n",
						link = null;

					if(DEBUG){ console.log("LINKS: " + BitlyExport.link_history.length.toString()); }
					for(var i = 0; i < BitlyExport.link_history.length; i++){
						link = BitlyExport.link_history[i];
						// Add the formatted csv row
						csv += BitlyExport.link_history_csv_template(link);
					}
					//Write to the csv
					fs.writeFile(outputFile, csv);
				}
				getUserLinkHistory();
			}
		}
	};

	if(access_token){
		Bitly.setAccessToken(access_token);
		if(BitlyExport.request[method]){
			BitlyExport.request[method]();
		}
	}else{
		Bitly.authenticate(username, password, function(err, response_access_token) {
			// Returns an error if there was one, or an access_token if there wasn't
			access_token = response_access_token;
			if(BitlyExport.request[method]){
				BitlyExport.request[method]();
			}
		});
	}
}
module.exports = cmd;

if(process.argv){
	// If invoked from the commandline run.
	cmd();
}

const request = require('request')
const fs = require('fs');
const {File} = require('atom')
const {Project} = require('atom')
const path = require('path')
let filelistHandeler = require('./FilelistHandeler.js')

// Make a post request to the server for new files
var postFile = function(file){
  return new Promise((resolve, reject) => {
    var cred = getCred()

    var filepath = atom.project.getPaths()[0] + '/data-source-items/' + file + '.json';
    var urlString = cred.baseUrl + "dynapp-server/rest/groups/" + cred.group + "/apps/" + cred.app + "/source/" + file
    var  headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'dynapp-atom'

    };

    var content = fs.readFileSync(filepath, 'utf8')

    var options = {
      url: urlString,
      method: 'POST',
      headers: headers,
      body: content,
      auth: {
        'user': cred.username,
        'pass': cred.password
      }
    };

    function callback(error, response, body) {
      if(response.statusCode != 201){
        atom.notifications.addWarning("Kunde inte spara data. Kolla dina uppgifter i dynappconfig.json", null)
        reject()
      }
      filelistHandeler.saveFileListToLocal()
      addOnDeleteListener()
      resolve()
    }
    request(options, callback);
  });
}

module.exports.postFile = postFile;

var addOnDeleteListener = function(){
  try{
    var cred = getCred()
    var filepath = atom.project.getPaths()[0] + '/data-source-items'
    fs.readdir(filepath, (err, files) => {
      files.forEach(file => {
        var fileName = ""
        if(file.indexOf('.json') != -1){
          fileName = path.basename(file, '.json')
        }  else if(file.indexOf('.py') != -1){
          fileName = path.basename(file, '.py')
        }
        var fileobj = new File(filepath +'/'+ file)
        fileobj.onDidDelete(function(cb){
          var urlString = cred.baseUrl + "dynapp-server/rest/groups/" + cred.group + "/apps/" + cred.app + "/source/" + fileName
          const settings = {
            buttons: [
              {
                onDidClick: function() {
                  var options = {
                    url: urlString,
                    method: 'DELETE',
                    headers:{
                      'User-Agent': 'dynapp-atom'

                    },
                    auth: {
                      'user': cred.username,
                      'pass': cred.password
                    }
                  };

                  function callback(error, response, body) {
                    if(response.statusCode != 204){
                      atom.notifications.addError("Kunde inte ta bort filen", options)
                    }
                    else{
                      atom.notifications.addInfo("Filen är nu borttagen, vänligen ta bort tillhörande fil", options)
                    }
                  }
                  request(options, callback);

                },
                text: "TA BORT"
              }

            ]}
          atom.notifications.addWarning("Vill du ta bort denna fil även på serven?", settings)
        });
      });
    });

  }catch(ex){

  }
}

module.exports.addOnDeleteListener = addOnDeleteListener;


var uploadSource = function(source, file){
  return new Promise(function(resolve, reject){
    var cred = getCred()

    if(!file['dirty']){
      resolve()
      return;
    }
    var urlString = cred.baseUrl + "dynapp-server/rest/groups/" + cred.group + "/apps/" + cred.app + "/source/" + source
    var  headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'dynapp-atom'

      };

    var filepathJson = atom.project.getPaths()[0] + '/data-source-items/' + source + '.json';
    var filepathPython =  atom.project.getPaths()[0] + '/data-source-items/' + source + '.py'

    var content = fs.readFileSync(filepathJson, 'utf8')
    content = JSON.parse(content);
    var b64String = new Buffer(fs.readFileSync(filepathPython, 'base64')).toString();
    content.stylesheet = b64String

    content = JSON.stringify(content)
    var options = {
      url: urlString,
      method: 'PUT',
      headers: headers,
      body: content,
      auth: {
        'user': cred.username,
        'pass': cred.password
      }
    };

    function callback(error, response, body) {
      if(response.statusCode > 204){
        atom.notifications.addWarning("Kunde inte spara alla filer. Kolla dina uppgifter i dynappconfig.json", null)
      }
      var resolveObj = {
        name: source,
        isUploaded: true,
        etag:response.headers.etag,
        list:"dataSources"
      }
      resolve(resolveObj)
    }
    request(options, callback);
  })
}
module.exports.uploadSource = uploadSource;

// get project credentials
var getCred = function(){
  var filepath = atom.project.getPaths()[0] + '/dynappconfig.json'
  var content = fs.readFileSync(filepath, 'utf8')
  var cred = JSON.parse(content)
  return cred
}


var downloadSource = function(name, etag){
  return new Promise(function(resolve,reject){
    var cred = getCred()

    filepath = atom.project.getPaths()[0]

    var options = {
      url: cred.baseUrl + "dynapp-server/rest/groups/" +cred.group + "/apps/" + cred.app + "/source/" + name,
      headers:{
            'Accept': 'application/json',
            'User-Agent': 'dynapp-atom'

          },
      auth: {
        user: cred.username,
        password: cred.password
      },
    }

    if(etag != undefined){
      etag = etag.replace("\"", '')
      etag = etag.replace("\"", '')
      options['headers']["If-None-Match"] = "\"" + etag +"\""

    }



    request(options, function(err, res, body) {
      if (err) {
        console.dir(err)
        reject()
        return
      }
      if(res.statusCode == 200){
        var resolveObj = {
          fileName: name,
          etag: res.headers.etag,
          list:"dataSources"
        }


        var obj = JSON.parse(body)
        var b64String = obj.stylesheet
        var decodedString = new Buffer(b64String, 'base64').toString('utf8')
        fs.writeFile(filepath + '/data-source-items/' + name + '.py', decodedString, 'binary', function(err) {});
        fs.writeFile(filepath + '/data-source-items/' + name + '.json', JSON.stringify(obj, null, 4));

        resolve(resolveObj)
      }else{
        resolve()
      }

    });
  });
}

module.exports.downloadSource = downloadSource;

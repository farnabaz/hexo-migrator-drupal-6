var YAML       = require('yamljs');
var mysql      = require('mysql');
var fs         = require('fs')
var mkdirp     = require('mkdirp');
var prompt = require('prompt');

var prefix;
var connection;
var step = 0;

function getNodes(err, rows, fields) {
  if (err) throw err;
  for (i in rows) {
    (function(node) {
      connection.query(`SELECT term_data.name FROM ${ prefix }term_data term_data, \
        ${ prefix }term_node term_node WHERE term_data.tid = term_node.tid AND term_node.nid = ` + node.nid,
        function(err, rows, fields) {
          var meta = {
            title: node.title,
            nid: node.nid,
            permalink: node.url,
            date: new Date(node.created * 1000).toString(),
          };
          if (rows.length > 0) {
            meta.tags = [];
            for (j in rows) {
              meta.tags.push(rows[j].name)
            }
          }

          var body = node.body;

          var content = "---\n";
          content += YAML.stringify(meta);
          content += "---\n";
          content += body
          mkdirp('source/_posts', function(err) {
            fs.writeFile("source/_posts/" + node.nid + ".md", content, function(err) {
                if (err) {
                  return console.log(err);
                }

                console.log("Node/Story " + node.nid + " Saved!");
            });
          });
      })
    })(rows[i]);
  }
  nextStep();
}
function getPages(err, rows, fields) {
  if (err) throw err;
  for (i in rows) {
    (function(node) {
      connection.query(`SELECT term_data.name FROM ${ prefix }term_data term_data, \
        ${ prefix }term_node term_node WHERE term_data.tid = term_node.tid AND term_node.nid = ` + node.nid,
        function(err, rows, fields) {
          var permalink = node.url;

          var meta = {
            title: node.title,
            nid: node.nid,
            date: new Date(node.created * 1000).toString(),
          };
          if (rows.length > 0) {
            meta.tags = []
            for (j in rows) {
              meta.tags.push(rows[j].name)
            }
          }
          var body = node.body;


          var content = "---\n";
          content += YAML.stringify(meta);
          content += "---\n";
          content += body
          mkdirp('source/' + permalink, function(err) {
            fs.writeFile('source/' + permalink + "/index.md", content, function(err) {
                if (err) {
                  return console.log(err);
                }

                console.log("Node/Page " + node.nid + " Saved!");
            });
          });
      })
    })(rows[i]);
  }
  nextStep();
}
function nextStep() {
  switch (step) {
    case 0:
    connection.query(`SELECT node.nid, \
                        (select dst from ${ prefix }url_alias where src = CONCAT('node/', node.nid) LIMIT 1) as url, \
                        node.title, \
                        node_revisions.body, \
                        node.created, \
                        node.status \
                 FROM ${ prefix }node node, \
                      ${ prefix }node_revisions node_revisions \
                 WHERE (node.type = 'story') \
                 AND node.vid = node_revisions.vid`, getNodes);
      break;
    case 1:
    connection.query(`SELECT node.nid, \
                       (select dst from ${ prefix }url_alias where src = CONCAT('node/', node.nid) LIMIT 1) as url, \
                       node.title, \
                       node_revisions.body, \
                       node.created, \
                       node.status \
                FROM ${ prefix }node node, \
                     ${ prefix }node_revisions node_revisions \
                WHERE (node.type = 'page') \
                AND node.vid = node_revisions.vid`, getPages);
      break;
    case 2:
      connection.end();
  }
  step ++;
}
hexo.extend.migrator.register('drupal-6', function(args) {
  // Start the prompt
  prompt.start();
  prompt.get([{
    name:'host',
    description: 'Database host',
    default: 'localhost'
  }, {
    name:'user',
    description: 'Database User',
  }, {
    name: "password",
    hidden: true,
    description: 'Database password'
  }, {
    name:'database',
    description: 'Database name'
  }, {
    name:'prefix',
    description: 'Table Prefixes'
  }], function (err, result) {

    prefix = result.prefix;
    connection = mysql.createConnection({
      host     : result.host,
      user     : result.user,
      password : result.password,
      database : result.database
    });
    connection.connect();
    nextStep()
  });

})

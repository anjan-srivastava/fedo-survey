var express = require('express');
var multer = require('multer');
var fs = require('fs');
var csvParser = require('csv-parse');
var upload = multer({dest: 'uploads/'});
var router = express.Router();

var session;
router.post('/import', upload.single('recepients'),
    function(req, res, next) {
        session = req.session;
        if (!req.file) {
            res.status(400).send("File required.");
            return;
        } else if(req.file.mimetype.indexOf('csv') === -1) {
            session.uploadedEmailsPath = null;
            res.status(400).send("Only CSVs are allowed.");
            if (req.file.path) { fs.unlink(req.file.path); }
            return;
        }

        var emails = []; 
        var onError = function(err) {
            if (req.file.path) { fs.unlink(req.file.path); }
            session.uploadedEmailsPath = null;
            res.status(400).send("Doesn't seem to be valid csv file.");

        },
        onRecord = function(rec) {
            if (rec.Email) {
                emails.push(rec.Email);
            } else if (rec.email) {
                emails.push(rec.Email);
            }
        };

        onDone = function() {
            if (req.file.path) { 
                fs.unlink(req.file.path);
                const parsedPath = req.file.path + '.json';
                if (emails.length) {
                    fs.writeFileSync(parsedPath, JSON.stringify({ _: emails } ));
                    session.uploadedEmailsPath = parsedPath;
                } else {
                    session.uploadedEmailsPath = null;
                }

            }
            if (emails.length) {
                res.json({"status": "success"});
            } else {
                res.status(400).send("CSV format is not correct");
            }
            res.end();
        };

        csvRecords(req.file.path, onRecord, onError, onDone);
    });


function csvRecords(path, onRecord, onError) {
    var parser = csvParser({delimiter: ',', columns: true}),
        source = fs.createReadStream(path);


    parser.on('readable', function() {
        var record;
        while ( (record=parser.read()) ) {
            onRecord(record);
        }
    });

    parser.on('error', function(error) { onError(error); });
    parser.on('end', function() { onDone(); });

    source.pipe(parser);
}

module.exports = router;

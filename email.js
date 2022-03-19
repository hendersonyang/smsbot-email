const Imap = require("imap")
const fs = require("fs")
const { Base64Decode } = require('base64-stream');

function findAttachmentParts(struct, attachments) {
    attachments = attachments || [];
    for (var i = 0, len = struct.length, r; i < len; ++i) {
        if (Array.isArray(struct[i])) {
            findAttachmentParts(struct[i], attachments);
        } else {
            if (struct[i].disposition && ['INLINE', 'ATTACHMENT'].indexOf(struct[i].disposition.type.toUpperCase()) > -1) {
                attachments.push(struct[i]);
            }
        }
    }
    return attachments;
}

module.exports.getEmail = function (callback) {
    let imap = new Imap({
        user: process.env.imap_username,
        password: process.env.imap_password,
        host: process.env.imap_server,
        port: process.env.imap_port,
        tls: true
    });
    function openInbox(cb) {
        imap.openBox('INBOX', false, cb);
    }
    imap.once('ready', function () {
        setInterval(() => {
            openInbox(function (err, box) {
                if (err) throw err;
                imap.search(['UNSEEN', ['SINCE', 'May 20, 2010']], function (err, results) {
                    if (err) throw err;
                    if (!results.length) return;
                    let f = imap.seq.fetch(results, {
                        bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)'],
                        markSeen: true,
                        struct: true
                    });
                    f.on('message', function (msg, seqno) {
                        let sms = false
                        let sender = ""
                        msg.on('body', function (stream, info) {
                            let buffer = '';
                            stream.on('data', function (chunk) {
                                buffer += chunk.toString('utf8');
                            });
                            stream.once('end', function () {
                                let header = Imap.parseHeader(buffer)
                                if (header.from[0].startsWith("+1")) {
                                    sms = true
                                    sender = header.from[0]
                                }
                            });
                        });
                        msg.once('attributes', function (attrs) {
                            if (!sms) return;
                            let attachments = findAttachmentParts(attrs.struct);
                            let attachment = attachments.find(a => a.params.name === "text_0.txt")
                            if (!attachment) return;
                            let f = imap.fetch(attrs.uid, {
                                bodies: [attachment.partID],
                                struct: true
                            });
                            f.on('message', function (msg, seqno) {
                                msg.on('body', function (stream, info) {
                                    let buffer = '';
                                    stream.on('data', function (chunk) {
                                        buffer += chunk.toString('utf8');
                                    });
                                    stream.once('end', function () {
                                        callback(atob(buffer), sender)
                                    });
                                });
                                msg.once('end', function () {
                                });
                            });
                        });
                        msg.once('end', function () {
                        });
                    });
                    f.once('error', function (err) {
                        console.log('Fetch error: ' + err);
                    });
                    f.once('end', function () {
                    });
                });
            });
        }, 5000)
    });

    imap.once('error', function (err) {
        console.log(err);
    });

    imap.once('end', function () {
    });

    imap.connect();
}
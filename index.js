require("dotenv").config()

const axios = require("axios")
const { SMTPClient } = require('emailjs');

const email = require("./email.js")

const client = new SMTPClient({
    user: process.env.smtp_username,
    password: process.env.smtp_password,
    host: process.env.smtp_server,
    port: process.env.smtp_port,
    tls: true
});

function reply(subject, response, sender) {
    client.send({
        from: `<contact@magicalcat.xyz>`,
        to: `<${sender}>`,
        subject: `${subject}`,
        text: `${response}`
    }, async function (err, message) {
        if (!err) {
            console.log(`Sent to ${sender}`, message.header['message-id'].slice(1, -1))
        } else {
            setTimeout(() => {
                reply(response, sender)
            }, 5000)
        }
    });
}

function callback(message, sender) {
    console.log(message, sender)
    if (!message.startsWith("?")) {
        reply("Error", "All commands must start with a question mark. For example ?weather California")
        return
    }
    const args = message.slice("?".length).split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === "weather") {
        if (!args[0]) {
            reply("Error", "Did not include 'location'. Example: ?weather California", sender)
            return
        }
        axios.get(`https://api.weatherapi.com/v1/current.json?key=${process.env.weather}&q=${args.join("+")}`).then(res => {
            if (res.data.error) {
                reply("Error", `${res.data.message}`, sender)
                return
            }
            reply("Success", `${res.data.location.name}, ${res.data.location.region}\n${res.data.current.condition.text}\nTemperature: ${res.data.current.temp_f}f ${res.data.current.temp_c}c\nUV Index: ${res.data.current.uv}\nWind Speed: ${res.data.current.wind_mph} mph\nWind Direction: ${res.data.current.wind_dir}`, sender)
        }).catch(error => {
            reply("Error", `Something went wrong with the request, try again later.`, sender)
        })
    }
}
email.getEmail(callback)
require("dotenv").config();

const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();

app.use(express.json());
app.use(cors());

/* ===============================
   CONFIG
=============================== */

const PORT = process.env.PORT || 3000;

const API_URL = process.env.API_URL;
const API_KEY = process.env.API_KEY;
const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;

const OTP_EXPIRY =
Number(process.env.OTP_EXPIRY) || 60000;

/* ===============================
   MEMORY STORES
=============================== */

let otpStore = {};
let activeSessions = {};

/* ===============================
   SERVER STATUS
=============================== */

app.get("/", (req, res) => {

res.status(200).send(
"WhatsApp OTP Server Running 🚀"
);

});

/* ===============================
   SEND OTP
=============================== */

app.post("/send-otp", async (req, res) => {

const {

name,
phoneNumber,
city

} = req.body;

if(!name || !phoneNumber || !city){

return res.json({

success:false,
message:"Missing fields"

});

}

try {

/* Save to Google Sheets */

await axios.post(

GOOGLE_SCRIPT_URL,

{

name: name,

phone: phoneNumber,

city: city,

action: "saveUser"

}

);

/* Generate OTP */

const otpCode =
Math.floor(
100000 + Math.random()*900000
).toString();

otpStore[phoneNumber] = {

otp: otpCode,

expiry:
Date.now() + OTP_EXPIRY

};

console.log(
`[OTP CREATED] ${phoneNumber} | ${otpCode}`
);

/* Send WhatsApp OTP */

const payload = {

apiKey: API_KEY,

campaignName: "OTP5",

destination: phoneNumber,

userName: name,

templateParams: [otpCode],

source: "nda-login",

buttons: [

{

type: "button",

sub_type: "url",

index: 0,

parameters: [

{

type: "text",

text: otpCode

}

]

}

]

};

await axios.post(
API_URL,
payload
);

console.log(
`[OTP SENT] ${phoneNumber}`
);

res.json({

success:true

});

}

catch(error){

console.error(
"[SEND OTP ERROR]",
error.message
);

res.status(500).json({

success:false

});

}

});

/* ===============================
   VERIFY OTP
=============================== */

app.post("/verify-otp", (req, res) => {

const {

phoneNumber,
otp,
deviceId

} = req.body;

const stored =
otpStore[phoneNumber];

if(!stored){

return res.json({

success:false,
message:"OTP not found"

});

}

/* Expiry Check */

if(Date.now() > stored.expiry){

delete otpStore[phoneNumber];

return res.json({

success:false,
message:"OTP Expired"

});

}

/* OTP Match */

if(stored.otp === otp){

/* Store Session */

activeSessions[phoneNumber] =
deviceId || uuidv4();

/* Device Detection */

let agent =
req.headers["user-agent"] || "";

let deviceType =

agent.includes("Android") ?
"Android Mobile" :

agent.includes("iPhone") ?
"iPhone" :

agent.includes("Windows") ?
"Windows PC" :

agent.includes("Mac") ?
"Mac" :

"Other Device";

/* IP */

let ip =
req.headers["x-forwarded-for"] ||
req.socket.remoteAddress;

/* Log */

console.log(
"========== LOGIN =========="
);

console.log(
`Phone: ${phoneNumber}`
);

console.log(
`Device: ${deviceType}`
);

console.log(
`IP: ${ip}`
);

console.log(
`Time: ${new Date()}`
);

console.log(
"==========================="
);

/* Remove OTP */

delete otpStore[phoneNumber];

return res.json({

success:true

});

}

else{

return res.json({

success:false,
message:"Invalid OTP"

});

}

});

/* ===============================
   SESSION CHECK
=============================== */

app.get("/check-session",

(req,res)=>{

const {

phone,
deviceId

} = req.query;

if(

activeSessions[phone] &&
activeSessions[phone] !== deviceId

){

return res.json({

active:false

});

}

res.json({

active:true

});

});

/* ===============================
   HEARTBEAT TRACKING
=============================== */

app.post("/heartbeat",

async (req,res)=>{

const { phone } = req.body;

if(!phone){

return res.status(400)
.json({

error:"Phone required"

});

}

try{

await axios.post(

GOOGLE_SCRIPT_URL,

{

phone: phone,

action: "heartbeat"

}

);

console.log(

`[HEARTBEAT] ${phone}`

);

res.json({

success:true

});

}

catch(error){

console.error(

"[HEARTBEAT ERROR]",
error.message

);

res.status(500)
.json({

success:false

});

}

});

/* ===============================
   START SERVER
=============================== */

app.listen(PORT, () => {

console.log(
`Server Started on ${PORT}`
);

});

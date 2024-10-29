const express = require("express");
const admin = require("firebase-admin");
const bodyParser = require("body-parser");
const moment = require("moment-timezone");
const app = express();
const port = 3000;

// Path to your serviceAccountKey.json file
const serviceAccount = require("./serviceAccountKey.json"); 

// Initialize the Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://skripsikitin-default-rtdb.firebaseio.com/", // Replace with your Firebase Database URL
});

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Endpoint to send notifications
app.post("/sendNotification", (req, res) => {
  const { title, body, token } = req.body;

  if (!title || !body || !token) {
    return res.status(400).send("Missing title, body, or token");
  }

  // Define the message payload
  const message = {
    notification: {
      title,
      body,
    },
    token,
  };

  // Send the notification
  admin
    .messaging()
    .send(message)
    .then((response) => {
      res.status(200).send(`Successfully sent message: ${response}`);
    })
    .catch((error) => {
      res.status(500).send(`Error sending message: ${error}`);
    });
});

function generateUniqueId(medicine, currentDate) {
  return `${medicine}_${currentDate}`;
}

app.get("/getData", (req, res) => {
  let uid = req.query.uid;

  uid = uid.replace(/"/g, "");
  console.log(`requesting data for uid: ${uid}`);

  if (!uid) {
    return res.status(400).send("-");
  }

  const ref = admin.database().ref(uid);

  ref
    .once("value")
    .then((snapshot) => {
      const data = snapshot.val();
      if (!data) {
        return res.status(404).send("-");
      }

      const medicine = checkMedicineSchedule(data);

      if (medicine) {
        const currentDate = moment().tz("Asia/Jakarta").format("DD/MM/YYYY HH:mm");
        const uniqueId = generateUniqueId(medicine, currentDate);

        const historyRef = admin.database().ref(`${uid}/history`);
        historyRef
          .orderByChild("uniqueId")
          .equalTo(uniqueId)
          .once("value")
          .then((snapshot) => {
            if (snapshot.exists()) {
              // History entry already exists
              //   log
              const message = {
                notification: {
                  title: "Medicine Reminder",
                  body: `It's time to take your ${medicine?.toUpperCase()}!`,
                },
                token: data.token,
              };
              admin.messaging().send(message).then((response) => {
                console.log(`Successfully sent message: ${response}`);
              });

              res.status(200).send(`${medicine?.toUpperCase()}`);
            } else {
              // Send notification
              const message = {
                notification: {
                  title: "Medicine Reminder",
                  body: `It's time to take your ${medicine}!`,
                },
                token: data.token,
              };

              admin
                .messaging()
                .send(message)
                .then((response) => {
                  console.log(`Successfully sent message: ${response}`);

                  // Create a new entry in the `history` child
                  const historyRef = admin
                    .database()
                    .ref(`${uid}/history`)
                    .push();
                  const currentTime = moment()
                    .tz("Asia/Jakarta")
                    .format("DD/MM/YYYY HH:mm:ss");
                  const historyData = {
                    uniqueId: uniqueId, // Add uniqueId to history
                    medicine: medicine,
                    notifiatedTime: currentTime,
                    takeTime: "-",
                    status: "pending",
                  };

                  historyRef
                    .set(historyData)
                    .then(() => {
                      console.log(`History updated successfully`);
                      res.status(200).send(`${medicine?.toUpperCase()}`);
                    })
                    .catch((error) => {
                      console.error(`Error updating history: ${error}`);
                      res.status(500).send(`-`);
                    });
                })
                .catch((error) => {
                  console.error(`Error sending notification: ${error}`);
                  res.status(500).send(`-`);
                });
            }
          })
          .catch((error) => {
            console.error(`Error checking history: ${error}`);
            res.status(500).send(`-`);
          });
      } else {
        res.status(500).send("-");
      }
    })
    .catch((error) => {
      res.status(500).send(`-`);
    });
});

function checkMedicineSchedule(data) {
  const currentDay = moment().tz("Asia/Jakarta").format("dddd"); // Get current day, e.g., "Monday"
  const currentTime = moment().tz("Asia/Jakarta").format("HH:mm"); // Get current time, e.g., "20:25"
  const today = moment().tz("Asia/Jakarta").format("DD/MM/YYYY"); // Get current date, e.g., "29/08/2024"

  for (let medicine in data.medicines) {
    const med = data.medicines[medicine];

    // Parse the date range
    const [startDate, endDate] = med.dateRange
      .split(" - ")
      .map((date) => moment(date, "DD/MM/YYYY"));

    // Check if today is within the date range
    if (
      moment(today, "DD/MM/YYYY").isBetween(startDate, endDate, "day", "[]")
    ) {
      // If the current day and time match
      if (med.days.includes(currentDay) && med.time.includes(currentTime)) {
        console.log(`Time to take your medicine: ${med.name}`);
        return med.name;
      } else {
        console.log(`Not time to take your medicine: ${med.name}`);
      }
    } else {
      console.log(`Not time to take your medicine: ${med.name}`);
    }
  }
  return null;
}

app.get("/getUid", (req, res) => {
  const ref = admin.database().ref(); // Reference to the root of the database
  console.log("requesting uid");

  ref
    .once("value")
    .then((snapshot) => {
      const data = snapshot.val(); // Get the data as a JavaScript object
      res.status(200).json(data?.esp?.uid); // Send the data as JSON
    })
    .catch((error) => {
      console.error(`-`);
      res.status(500).send("-");
    });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});

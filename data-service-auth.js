var mongoose = require("mongoose");
var Schema = mongoose.Schema;
const bcrypt = require("bcryptjs");

var userSchema = new Schema({
    "userName": {
        "type": String,
        "unique": true,
    },
    "password": String,
    "email": String,
    "loginHistory": [{
        "dateTime": Date,
        "userAgent": String,
    }]
});

let User; // to be defined on new connection (see initialize)

module.exports.initialize = function () {
    return new Promise(function (resolve, reject) {
        let db = mongoose.createConnection(`mongodb+srv://${process.env.Mongoose_USERNAME}:${process.env.Mongoose_PASSWORD}@senecaweb.7tbfa.mongodb.net/web322_Assignment?retryWrites=true&w=majority`, {useNewUrlParser: true});
        db.on('error', (err)=>{
            reject(err); // reject the promise with the provided error
        });
        db.once('open', ()=>{
             User = db.model("users", userSchema);
             resolve();
        });
    });
}

module.exports.registerUser = function (userData) {
    return new Promise((resolve, reject) => {
        if (userData.password != userData.password2) {
            reject("Passwords do not match");
        } else {
            bcrypt.genSalt(10, (err, salt) => {
                bcrypt.hash(userData.password, salt, (err, hash) => {
                    if (err) {
                        reject("There was an error encrypting the password");
                    } else {
                        userData.password = hash;
                        let newUser = new User(userData);
                        newUser.save()
                        .then(() => {
                            resolve();
                        })
                        .catch((err) => {
                            if (err.code == 11000) {
                                reject("User Name already taken");
                            } else {
                                reject("There was an error creating the user: " + err);
                            }
                        });
                    }
                });
            });
        }
    });
}

module.exports.checkUser = function (userData) {
    return new Promise((resolve, reject) => {
        User.find({ userName: userData.userName })
        .then((users) => {
            bcrypt.compare(userData.password, users[0].password)
            .then((res) => {
                if (res === true) {
                    users[0].loginHistory.push({
                        dateTime: new Date().toString(),
                        userAgent: userData.userAgent,
                    });
                    User.updateOne(
                        { userName: userData.userName },
                        {$set: { loginHistory: users[0].loginHistory }})
                        .exec()
                        .then(() => {
                            resolve(users[0]);
                        })
                        .catch((err) => {
                            reject("There was an error verifying the user: " + err);
                        }
                    );
                }
                else {
                    reject("Incorrect Password for user: " + userData.userName);
                }
            });
        })   
        .catch(() => {
            reject("Unable to find user: " + userData.userName);
        });
    });
}
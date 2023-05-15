var fs = require("fs");
var dataService = require("./data-service.js");
var dataServiceAuth = require("./data-service-auth.js");
var express = require("express");
var multer = require("multer");
var exphbs = require("express-handlebars");
var bodyParser = require("body-parser");
var app = express();
var path = require("path");
var static = require("serve-static");
var clientSessions = require("client-sessions");
var HTTP_PORT = process.env.PORT || 8080;
require("dotenv").config();

function onHttpStart(){
    console.log("Express http server listening on " + HTTP_PORT);
}

app.use(clientSessions({
    cookieName: "session",
    secret: "web322_a6",
    duration: 30 * 60 * 1000, // 30 minutes
    activeDuration: 15 * 60 * 1000 // 15 minutes
}));

app.use(function(req, res, next) {
    res.locals.session = req.session;
    next();
});

function ensureLogin(req, res, next) {
    if (!req.session.user) {
        res.redirect('/login');
    } else {
        next();
    }
}

app.use(express.static('public'))

app.use(bodyParser.urlencoded({extended: true}));

app.engine('.hbs', exphbs({
    extname: '.hbs',
    defaultLayout: 'main',
    helpers: {
        navLink: function(url, options){
            return '<li' +
            ((url == app.locals.activeRoute) ? ' class="active" ' : '') +
            '><a href="' + url + '">' + options.fn(this) + '</a></li>';
            }, 
        equal: function (lvalue, rvalue, options) {
        if (arguments.length < 3)
        throw new Error("Handlebars Helper equal needs 2 parameters");
        if (lvalue != rvalue) {
        return options.inverse(this);
        } else {
        return options.fn(this);}
        }
    }
}));

app.set('view engine', '.hbs');

app.use(function(req,res,next){
    let route = req.baseUrl + req.path;
    app.locals.activeRoute = (route == "/") ? "/" : route.replace(/\/$/, "");
    next();
});

var storage = multer.diskStorage({
    destination: "./public/images/uploaded", filename: function (req, file, cb){
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

var upload = multer({ storage: storage });
////////////////////////////////////////////////////////
app.get("/", function(req, res){
    res.render("home");
});

app.get("/about", function(req, res){
    res.render("about");
});

app.get("/images", ensureLogin, (req, res) => {
    fs.readdir("./public/images/uploaded", function(err, imageFile){
        res.render("images",{"images": imageFile});
    });
});

app.get("/images/add", ensureLogin, (req,res) => {
    res.render("addImage"); 
}); 

app.get("/employees", ensureLogin, function(req, res){
    if (req.query.status){
        dataService.getEmployeesByStatus(req.query.status)
        .then((data) => {
            if (data.length > 0) {
                res.render("employees", {employees:data});
            }
            else{
                res.render("employees", {message: "no results"});
            }
        }).catch(() => {
            res.status(500).send("unable to get employees by status");
        })
    }       
    else if (req.query.department){
        dataService.getEmployeesByDepartment(req.query.department)
        .then((data) => {
            if (data.length > 0) {
                res.render("employees", {employees:data});
            }
            else{
                res.render("employees", {message: "no results"});
            }
        }).catch(() => {
            res.status(500).send("unable to get employees by department");
        })
    }
    else if (req.query.manager) {
        dataService.getEmployeesByManager(req.query.manager)
        .then((data) => {
            if (data.length > 0) {
                res.render("employees", {employees:data});
            }
            else{
                res.render("employees", {message: "no results"});
            }
        }).catch(() => {
            res.status(500).send("unable to get employees by manager");
        })
    }
    else {
        dataService.getAllEmployees()
        .then((data) => {
            if (data.length > 0) {
                res.render("employees", {employees:data});
            }
            else{
                res.render("employees", {message: "no results"});
            }
        }).catch(() => {
            res.status(500).send("unable to get all employees");
        })
    }
});

app.get("/employee/:empNum", ensureLogin, (req, res) => {
    // initialize an empty object to store the values
    let viewData = {};
    dataService.getEmployeeByNum(req.params.empNum).then((data) => {
        if (data) {
            viewData.employee = data; //store employee data in the "viewData" object as "employee"
        } else {
            viewData.employee = null; // set employee to null if none were returned
        }
    }).catch(() => {
        viewData.employee = null; // set employee to null if there was an error
    }).then(dataService.getDepartments)
    .then((data) => {
        viewData.departments = data; // store department data in the "viewData" object as "departments"
        // loop through viewData.departments and once we have found the departmentId that matches
        // the employee's "department" value, add a "selected" property to the matching
        // viewData.departments object
        for (let i = 0; i < viewData.departments.length; i++) {
            if (viewData.departments[i].departmentId == viewData.employee.department) {
                viewData.departments[i].selected = true;
            }
        }
    }).catch(() => {
        viewData.departments = []; // set departments to empty if there was an error
    }).then(() => {
        if (viewData.employee == null) { // if no employee - return an error
            res.status(404).send("Employee Not Found");
        } else {
            res.render("employee", { viewData: viewData }); // render the "employee" view
        }
    });
});

app.get("/employees/delete/:empNum", ensureLogin, (req, res) => {
    dataService.deleteEmployeeByNum(req.params.empNum)
        .then(() => {
            res.redirect("/employees");
        }).catch(() => {
            res.status(500).send("Unable to Remove Employee / Employee not found");
        });
});

app.get("/department/:departmentId", ensureLogin, (req, res) => {
    dataService.getDepartmentById(req.params.departmentId)
    .then((data) => {
        if (data) {
            res.render("department", {
                department: data
            });
        }
        else{
            res.status(404).send("Department Not Found");
        }
    })
    .catch(() => {
        res.status(404).send("Department Not Found");
    });
});

app.get("/departments/delete/:departmentId", ensureLogin, (req, res) => {
    dataService.deleteDepartmentById(req.params.departmentId)
        .then(() => {
            res.redirect("/departments");
        }).catch(() => {
            res.status(500).send("Unable to Remove Department / Department not found");
        });
});

app.get("/employees/add", ensureLogin, function(req, res){
    dataService.getDepartments()
    .then((data) => {
        res.render("addEmployee", {departments: data});
    })
    .catch(() => {
        res.render("addEmployee", {departments: []});
    });
});

app.get("/departments", ensureLogin, function(req, res){
    dataService.getDepartments()
    .then((data) => {
        if (data.length > 0) {
            console.log(data[0].departmentName);
            res.render("departments", {departments: data});
        }
        else{
            res.render("departments", {message: "no results"});
        }
    })
    .catch((err) => {
        res.render("departments", {message: "unable to get departments"});
    })
});

app.get("/departments/add", ensureLogin, function(req, res) {
    res.render("addDepartment");
})
////////////////////////////////////////////////////////
app.post("/departments/add", ensureLogin, (req, res) => {
    dataService.addDepartment(req.body)
    .then(() => {
        res.redirect("/departments");
    })
    .catch(() => {
        res.status(500).send("unable to add department");
    });
});

app.post("/images/add", upload.single("imageFile"), ensureLogin, (req, res) => {
    res.redirect("/images");
});

app.post("/employees/add", ensureLogin, (req, res) => {
    dataService.addEmployee(req.body)
    .then(()=>{
        res.redirect("/employees");
    })
    .catch(() => {
        res.status(500).send("unable to add employee");
    });
});

app.post("/employee/update", ensureLogin, (req, res) => { 
    dataService.updateEmployee(req.body)
    .then(() => {
        res.redirect("/employees");
    })
    .catch(() => {
        res.status(500).send("unable to update employee");
    })
});

app.post("/department/update", ensureLogin, (req, res) => {
    dataService.updateDepartment(req.body)
    .then(() => {
        res.redirect("/departments");
    })
    .catch(() => {
        res.status(500).send("unable to update department");
    });
});
////////////////////////////////////////////////////////
app.get("/login", (req, res) => {
    res.render("login");
});

app.get("/register", (req, res) => {
    res.render("register");
});

app.post("/register", (req, res) => {
    dataServiceAuth.registerUser(req.body)
    .then(() => {
        res.render("register", {successMessage: "User created"});
    })
    .catch((err) => {
        res.render("register", {errorMessage: err, userName: req.body.userName});
    });
});

app.post("/login", (req, res) => {
    req.body.userAgent = req.get("User-Agent");
    dataServiceAuth.checkUser(req.body).then((user) => {
        req.session.user = {
            userName: user.userName, // authenticated user's userName
            email: user.email, // authenticated user's email
            loginHistory: user.loginHistory // authenticated user's loginHistory
        }
        res.redirect('/');
    })
    .catch((err) => {
        res.render("login", {errorMessage: err, userName: req.body.userName});
    });
});

app.get("/logout", (req, res) => {
    req.session.reset();
    res.redirect("/");
});

app.get("/userHistory", ensureLogin, (req, res) => {
    res.render("userHistory");
});

app.use((req, res) => {
    res.status(404).send("Page Not Found!");
});

dataService.initialize()
.then(dataServiceAuth.initialize)
.then(() => {
    console.log("start the server");
    app.listen(HTTP_PORT, onHttpStart);
})
.catch(err => {
    console.log("unable to start server: " +err);
});
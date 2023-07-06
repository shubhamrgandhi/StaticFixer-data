const log = require('../log');
const util = require('../util');
const models = require('../models');
const csv = require("fast-csv");
var validator = require('validator');
// var fs = require('fs');
var express = require('express');
var router = express.Router();
var multer = require('multer');
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, validator.escape(
              req.user.company_id
              + '-'
              + file.fieldname
              + '-'
              + Date.now()
              + '-'
              + file.originalname));
  }
});
var upload = multer({ storage: storage });

router.post('/receipt', upload.single('receipt'), function(req, res, next) {
  if(!req.isAuthenticated()) {
    return res.render('login', { message: '' });
  }
  if (!req.file) {
    return res.status(400).send('No files were uploaded.');
  }
  console.log(req.file.filename);
  console.log(req.file.originalname);
  res.send(req.file.filename);
});

router.post('/statement/:methodId', upload.single('statement'), function(req, res, next) {
  if(!req.isAuthenticated()) {
    return res.render('login', { message: '' });
  }
  if (!req.file) {
    return res.status(400).send('No files were uploaded.');
  }
  var row = 0;
  var importConfig;
  var defaultUnitId;
  var expenseTypes;
  var expenses = [];
  models.ImportStatementConfig.findAll({
    where: {
      company_id: req.user.company_id
    },
    limit: 1
  }).then(importStatementConfig => {
    importConfig = importStatementConfig[0];
    models.ExpenseType
          .findAll()
          .then(types => {
            expenseTypes = types;
            models.Property.findAll({
              where: {
                company_id: req.user.company_id
              },
              include: [{
                  model: models.PropertyUnit
              }]
            }).then(properties => {
              defaultUnitId = properties[0].PropertyUnits[0].id;

              csv.parseFile(req.file.path)
                 .on("data", function(data){
                   console.log(data);
                   row++;
                   if(row === 1) {
                     // skip first row as header
                     return;
                   }
                   var filter = data[importConfig.filter_column_number];
                   var regex = new RegExp( importConfig.filter_keyword.replace(",", "|") , "i");
                   if(regex.test(filter)) {
                     var expense_type_id = 9;
                     for(let i = 0; i < expenseTypes.length; i++) {
                       if(data[importConfig.category_column_number].includes(expenseTypes[i].name)) {
                         expense_type_id = expenseTypes[i].id;
                       }
                     }
                     expenses.push({
                       unit_id: defaultUnitId,
                       pay_to: data[importConfig.pay_to_column_number],
                       type_id: expense_type_id,
                       description: util.getImportDescription(data[importConfig.description_column_number], data[importConfig.filter_column_number]),
                       amount: util.getImportAmount(parseFloat(data[importConfig.amount_column_number]), data[importConfig.filter_column_number]),
                       pay_time: new Date(data[importConfig.date_column_number]),
                       method_id: req.params.methodId,
                       file: ''
                     });
                   }
                 })
                 .on("end", function(){
                   console.log(expenses);
                   models.Expense
                         .bulkCreate(expenses, {returning: true});
                   log.info('import done for user_id: ' + req.user.id);
                   console.log('import done for user_id: ' + req.user.id);
                 });
            });
          });
  });
  res.send(validator.escape(req.file.originalname));
});
module.exports = router;

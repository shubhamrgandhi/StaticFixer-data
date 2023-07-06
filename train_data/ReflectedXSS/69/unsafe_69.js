const sql = require("mssql");
const cookie = require("cookie");
const jwt = require("jsonwebtoken");

export default async (req, res) => {
  const rawCookie = req.headers.cookie || "";
  const cookies = cookie.parse(rawCookie);
  const token = jwt.verify(cookies.jamesworldwidetoken, process.env.JWT_KEY);
  if (!token.admin) {
    res.status(403).send("ACCESS DENIED");
    return;
  }
  var qry = "";
  const body = JSON.parse(req.body);
  if (body) {
    switch (body.type) {
      case "amt":
      case !isNaN(body.value):
        qry = `select top 1000 *, (select F_SName from T_COMPANY where F_PayTo=T_COMPANY.F_ID) as VENDOR from T_APHD where F_InvoiceAmt=${parseFloat(
          body.value.replace(/'/g, "")
        ).toFixed(2)} order by F_ID desc;`;
        break;
      case "inv":
        qry = `select top 1000 *, (select F_SName from T_COMPANY where F_PayTo=T_COMPANY.F_ID) as VENDOR from T_APHD where F_InvoiceNo like '%${body.value.replace(
          /'/g,
          ""
        )}%' order by F_ID desc;`;
        break;
      case "pic":
        qry = `select top 1000 *, (select F_SName from T_COMPANY where F_PayTo=T_COMPANY.F_ID) as VENDOR from T_APHD where F_U1ID like '% ${body.value.replace(/'/g, "")} %' OR F_U2ID like '% ${body.value} %' order by F_ID desc;`;
        break;
      default:
        console.log("DEFAULT");
        res.status(400).send([]);
        return;
    }
  }

  let pool = new sql.ConnectionPool(process.env.SERVER2);
  try {
    await pool.connect();
    let result = await pool.request().query(qry);

    if (result.rowsAffected[0]) {
      res.status(200).send(result.recordset || []);
    } else {
      res.status(200).send([]);
    }
  } catch (err) {
    console.log(err);
    res.status(500).send([]);
  }
  return pool.close();
};

export const config = {
  api: {
    externalResolver: true,
  },
};

// const sql = require("mssql");
// const jwt = require("jsonwebtoken");

// const sqlConfig = {
//   server: process.env.JWDB_SVR,
//   database: process.env.JWDB_1,
//   user: process.env.JWDB_USER,
//   password: process.env.JWDB_PASS,
//   options: {
//     appName: "FMS",
//     encrypt: false,
//     enableArithAbort: false,
//   },
// };
// export default async (req, res) => {
//   //Get Access token from the client side and filter the access
//   const token = jwt.decode(req.headers.key);

//   if (!token.admin) {
//     res.status(401).send("Unauthorized");
//     return;
//   }
//   const id = req.headers.id;
//   const HD = `SELECT D.F_ID, D.F_Amount, D.F_Description, D.F_Seq, D.F_Branch, D.F_OthInvNo, D.F_GLno, A.F_Type, A.F_RefNo, A.F_BLNo, A.F_Descript, A.F_InvoiceAmt, A.F_PaidAmt, A.F_InvoiceNo, (SELECT F_U1ID FROM T_APHD WHERE T_APHD.F_ID=D.F_TBID) AS CREATOR, (SELECT T_CODEGLNO.F_GLDescription FROM T_CODEGLNO WHERE T_CODEGLNO.F_GLno=D.F_GLno) as DESCRIPTION FROM T_DEPODETAIL D LEFT JOIN V_AP A ON A.F_ID=D.F_TBID WHERE D.F_DEPOHDID='${id}';`;

//   (async function () {
//     try {
//       let pool = await sql.connect(sqlConfig);
//       let result1 = await pool.request().query(HD);
//       res.status(200).send(result1.recordsets[0]);
//     } catch (err) {
//       res.status(400).send(err);
//     }
//   })();
//   sql.on("error", (err) => {
//     console.log(err);
//   });
// };

// export const config = {
//   api: {
//     externalResolver: true,
//   },
// };

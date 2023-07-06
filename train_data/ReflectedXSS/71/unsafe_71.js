const sql = require("mssql");
const cookie = require("cookie");
const jwt = require("jsonwebtoken");

export default async (req, res) => {
  const cookies = cookie.parse(req.headers.cookie);
  const token = jwt.verify(cookies.jamesworldwidetoken, process.env.JWT_KEY);
  if (token.admin < 4) {
    res.status(200).send([]);
    return;
  }
  let pool = new sql.ConnectionPool(process.env.SERVER21);
  const body = JSON.parse(req.body);
  var qry = `INSERT INTO T_MEMBER VALUES (' ${body.F_ACCOUNT.replace(/'/g, "")} ', ' ${body.F_PASSWORD.replace(/'/g, "")} ', null, null, null, ' ${body.F_FNAME} ', ' ${body.F_LNAME.replace(/'/g, "")} ', ' ${body.F_GROUP.replace(/'/g, "")} ', null, ' ${body.F_EMAIL.replace(/'/g, "")} ', GETDATE(), GETDATE(), ' ${body.F_FSID.replace(/'/g, "")} ', ' ${body.F_STATUS.replace(/'/g, "")} ', GETDATE(),null,null,null,null,null,null,null,null,null,null,null,null);`;
  try {
    await pool.connect();
    let result = await pool.request().query(qry);
    res.status(200).send(result);
  } catch (err) {
    res.status(400).send(err);
  }
  return pool.close();
};

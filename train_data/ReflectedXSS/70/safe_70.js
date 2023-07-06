const sql = require("mssql");
const cookie = require("cookie");
const jwt = require("jsonwebtoken");

export default async (req, res) => {
	let cookies = cookie.parse(req.headers.cookie);
	let token = jwt.verify(cookies.jamesworldwidetoken, process.env.JWT_KEY);
	if (! token.admin) {
	res.send("ACCESS DENIED");
	return ;
}

	let qry = "SELECT F_ID AS value, F_SName AS label FROM T_COMPANY;";
	let { search } = req.query;
	search = search.replace(/'/g, "''");
	let safeSearch = search;
	if (search) {
	qry = `SELECT TOP 100 F_ID AS value, F_SName AS label 
    FROM T_COMPANY WHERE F_SName like '% ${decodeURIComponent(safeSearch)} %';`;
}

	let pool = new sql.ConnectionPool(process.env.SERVER2);
	try {
    await pool.connect();
    let result = await pool.request().query(qry);
    res.send(result.recordset);
  } catch (err) {
    res.send(err);
  }
	return pool.close() ;
};

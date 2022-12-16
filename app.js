const express = require("express");
const app = express();
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
let db = null;

app.use(express.json());

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Sever started running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error ${e.message}`);
  }
};
initializeDBAndServer();

const convertDBObjectToResponseObject = (dbResponse) => {
  return {
    stateId: dbResponse.state_id,
    stateName: dbResponse.state_name,
    population: dbResponse.population,
  };
};

const convertDistrictDbObjectToResponseObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeaders = request.headers["authorization"];
  if (authHeaders !== undefined) {
    jwtToken = authHeaders.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "saikumar@123", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getSelectUser = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(getSelectUser);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);

    if (isPasswordMatched === true) {
      const payload = { username: username };

      const jwtToken = jwt.sign(payload, "saikumar@123");
      response.send({ jwtToken });
      console.log(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// get states API

app.get("/states/", authenticateToken, async (request, response) => {
  const statesQuery = `SELECT * FROM state`;
  const statesArray = await db.all(statesQuery);
  response.send(
    statesArray.map((eachState) => convertDBObjectToResponseObject(eachState))
  );
});

module.exports = app;

// get state API

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `SELECT * FROM state WHERE state_id = ${stateId}`;
  const getState = await db.get(getStateQuery);
  response.send(convertDBObjectToResponseObject(getState));
});

// add district API

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const updateDistrict = `
  INSERT INTO
    district (district_name, state_id, cases, cured, active, deaths)
  VALUES
    (
    '${districtName}', 
     ${stateId}, 
     ${cases}, 
     ${cured}, 
     ${active},
     ${deaths})
  `;
  await db.run(updateDistrict);
  response.send("District Successfully Added");
});

// API for district

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
  SELECT * FROM district WHERE district_id = ${districtId}
  `;
    const getDistrict = await db.get(getDistrictQuery);
    response.send(convertDistrictDbObjectToResponseObject(getDistrict));
  }
);

// delete API

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDeleteQuery = `
  DELETE FROM
    district
  WHERE
   district_id = ${districtId}
  `;
    await db.run(districtDeleteQuery);
    response.send("District Removed");
  }
);

//update district API

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;

    const updateDistrict = `
  UPDATE 
    district
  SET
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
    
  WHERE
    district_id = ${districtId}
    
  `;
    await db.run(updateDistrict);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `
    SELECT
      SUM(cases),
      SUM(cured),
      SUM(active),
      SUM(deaths)
    FROM
      district
    WHERE
      state_id=${stateId};`;
    const stats = await db.get(getStateStatsQuery);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);


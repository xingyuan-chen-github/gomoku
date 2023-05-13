const express = require("express");
const path = require("path");
const jwt = require("jsonwebtoken");
const { expressjwt } = require("express-jwt");
const Contract = require("web3-eth-contract");
const contractJson = require("../artifacts/contracts/Gomoku.sol/Gomoku.json");
const bodyParser = require("body-parser");
const cors = require('cors')

const app = express();
const port = 3000;
const jsonParser = bodyParser.json();
const JWT_SECRET_KEY = "jwt_secret_key";

Contract.setProvider("ws://127.0.0.1:8545");
const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const contractAbi = contractJson.abi;
const contract = new Contract(contractAbi, contractAddress);

// user id -> game
const userGameMap = new Map();

/**
 * add cors for all endpoints
 */
app.use(cors())

/**
 * auth check for all endpoints except get_token
 */
app.use(
    "/api",
    expressjwt({
        secret: JWT_SECRET_KEY,
        algorithms: ["HS256"],
    }).unless({ path: ["/api/get_token"] })
);

/**
 * return game page
 */
app.get("/", async (_, res) => {
    res.sendFile(path.join(__dirname, "/index.html"));
});

/**
 * return a token
 */
app.post("/api/get_token", async (_, res) => {
    const token = jwt.sign(
        // I just use timestamp as user id since this is a toy app
        { id: Date.now() },
        JWT_SECRET_KEY,
        { expiresIn: "100y", algorithm: "HS256" }
    );

    res.send({ token });
});

/**
 * start a game
 */
app.post("/api/start_game", jsonParser, async (req, res) => {
    const gomokuboard = [];
    const win = [];
    const blackWin = [];
    const whiteWin = [];
    let count = 0;

    for (let i = 0; i < 15; i++) {
        win[i] = [];
        for (let j = 0; j < 15; j++) {
            win[i][j] = [];
        }
    }

    for (let i = 0; i < 15; i++) {
        for (let j = 0; j < 11; j++) {
            for (let k = 0; k < 5; k++) {
                win[i][j + k][count] = true;
            }
            count++;
        }
    }
    for (let i = 0; i < 15; i++) {
        for (let j = 0; j < 11; j++) {
            for (let k = 0; k < 5; k++) {
                win[j + k][i][count] = true;
            }
            count++;
        }
    }
    for (let i = 0; i < 11; i++) {
        for (let j = 0; j < 11; j++) {
            for (let k = 0; k < 5; k++) {
                win[i + k][j + k][count] = true;
            }
            count++;
        }
    }
    for (let i = 0; i < 11; i++) {
        for (let j = 0; j < 11; j++) {
            for (let k = 0; k < 5; k++) {
                win[i + k][14 - j - k][count] = true;
            }
            count++;
        }
    }

    for (let i = 0; i < count; i++) {
        blackWin[i] = 0;
        whiteWin[i] = 0;
    }

    for (let i = 0; i < 15; i++) {
        gomokuboard[i] = [];
        for (let j = 0; j < 15; j++) {
            gomokuboard[i][j] = "empty";
        }
    }

    userGameMap.set(req.auth.id, { win, count, gomokuboard, blackWin, whiteWin });
    await contract.methods.initGame(req.auth.id).call();
    res.end();
});

/**
 * place a stone
 */
app.post("/api/place", jsonParser, async (req, res) => {
    const { x, y } = req.body;
    const { win, count, gomokuboard, blackWin, whiteWin } = userGameMap.get(req.auth.id);
    if (gomokuboard[x][y] === "empty") {
        gomokuboard[x][y] = "black";

        for (k = 0; k < count; k++) {
            if (win[x][y][k]) {
                blackWin[k]++;
                whiteWin[k] = 6;
                if (blackWin[k] === 5) {
                    await contract.methods.recordPlacement(req.auth.id, x, y , "black").call();
                    res.send({ gameStatus: "game-over", message: "you win!" });
                    return;
                }
            }
        }
    }
    else {
        res.send({ gameStatus: "error", message: "invalid placement!" });
        return;
    }
    const whitePlacement = calcWhitePlacement(gomokuboard, win, blackWin, whiteWin, count);
    for (k = 0; k < count; k++) {
        if (win[whitePlacement.x][whitePlacement.y][k]) {
            whiteWin[k]++;
            blackWin[k] = 6;
            if (whiteWin[k] == 5) {
                await contract.methods.recordPlacement(req.auth.id, whitePlacement.x,  whitePlacement.y, "white").call();
                res.send({ gameStatus: "game-over", message: "you lost!" });
                return;
            }
        }
    }
    await contract.methods.recordPlacement(req.auth.id, x, y , "black").call();
    await contract.methods.recordPlacement(req.auth.id, whitePlacement.x,  whitePlacement.y, "white").call();
    res.send({ gameStatus: "in-process", ...whitePlacement });
});

const calcWhitePlacement = (gomokuboard, win, blackWin, whiteWin, count) => {
    //得分数据
    const blackScore = [];
    const whiteScore = [];
    let max = 0;
    let u = 0; v = 0;
    //得分初始化
    for (let i = 0; i < 15; i++) {
        blackScore[i] = [];
        whiteScore[i] = [];
        for (let j = 0; j < 15; j++) {
            blackScore[i][j] = 0;
            whiteScore[i][j] = 0;
        }
    }

    for (let i = 0; i < 15; i++) {
        for (let j = 0; j < 15; j++) {
            if (gomokuboard[i][j] == "empty") //不能下在我下过的地方
                for (let k = 0; k < count; k++) {
                    if (win[i][j][k]) {//下这里可以赢
                        if (blackWin[k] == 1) { blackScore[i][j] += 200; }
                        else if (blackWin[k] == 2) { blackScore[i][j] += 400; }
                        else if (blackWin[k] == 3) { blackScore[i][j] += 2000; }
                        else if (blackWin[k] == 4) { blackScore[i][j] += 10000; }


                        if (whiteWin[k] == 1) { whiteScore[i][j] += 200; }
                        else if (whiteWin[k] == 2) { whiteScore[i][j] += 420; }
                        else if (whiteWin[k] == 3) { whiteScore[i][j] += 2100; }
                        else if (whiteWin[k] == 4) { whiteScore[i][j] += 20000; }
                    }
                }
            if (blackScore[i][j] > max) {
                max = blackScore[i][j];
                u = i;
                v = j;
            }
            else if (blackScore[i][j] == max) {
                if (whiteScore[i][j] > whiteScore[u][v]) {
                    u = i;
                    v = j;
                }
            }
            if (whiteScore[i][j] > max) {
                max = whiteScore[i][j];
                u = i;
                v = j;
            }
            else if (whiteScore[i][j] == max) {
                if (blackScore[i][j] > blackScore[u][v]) {
                    u = i;
                    v = j;
                }
            }
        }
    }
    gomokuboard[u][v] = "white";
    return { x: u, y: v }
}

/**
 * start server
 */
app.listen(port, '0.0.0.0', () => {
    console.log(`app listening on port ${port}`);
});
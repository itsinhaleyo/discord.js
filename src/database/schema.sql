CREATE DATABASE discordjs;

CREATE TABLE users (
    userid VARCHAR(100) NOT NULL PRIMARY KEY,
    balance BIGINT NOT NULL,
    daily VARCHAR(100) NOT NULL,
    username VARCHAR(255) NOT NULL,
    avatar VARCHAR(100) NOT NULL,
    xp INT NOT NULL DEFAULT 1,
    level INT NOT NULL DEFAULT 1
);

CREATE TABLE cooldown (
    userid VARCHAR(100) NOT NULL PRIMARY KEY,
    command VARCHAR(255) NOT NULL,
    endsAt VARCHAR(100) NOT NULL
);

CREATE TABLE towers (
    userid VARCHAR(100) NOT NULL PRIMARY KEY,
    status VARCHAR(2) NOT NULL,
    bet VARCHAR(20) NOT NULL,
    item1 VARCHAR(5) NOT NULL,
    item2 VARCHAR(5) NOT NULL,
    item3 VARCHAR(5) NOT NULL,
    item4 VARCHAR(5) NOT NULL,
    item5 VARCHAR(5) NOT NULL
);

CREATE TABLE hilow (
    userid VARCHAR(100) NOT NULL PRIMARY KEY,
    lastNumber VARCHAR(5) NOT NULL
);

CREATE TABLE guilds(
    guildid VARCHAR(100) NOT NULL PRIMARY KEY
);

CREATE TABLE portfolios (
    userid VARCHAR(100) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    shares BIGINT NOT NULL DEFAULT 0,
    leverage VARCHAR(10) DEFAULT 1,
    margin_used DOUBLE DEFAULT 0,
    PRIMARY KEY (userid, symbol)
);

CREATE TABLE playercheck (
    id VARCHAR(100) NOT NULL PRIMARY KEY,
    nonce BIGINT NOT NULL
);

CREATE TABLE stock_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userid VARCHAR(255) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    action ENUM('BUY', 'SELL') NOT NULL,
    amount DECIMAL(18, 8) NOT NULL,
    price_per_share DECIMAL(18, 8) NOT NULL,
    total_cost DECIMAL(18, 2) NOT NULL,
    leverage INT DEFAULT 1,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
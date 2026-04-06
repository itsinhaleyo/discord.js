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
    take_profit DOUBLE DEFAULT NULL,
    stop_loss DOUBLE DEFAULT NULL,  
    side ENUM('LONG', 'SHORT') DEFAULT 'LONG',
    PRIMARY KEY (userid, symbol)
);

CREATE TABLE playercheck (
    userid VARCHAR(100) NOT NULL PRIMARY KEY,
    nonce BIGINT NOT NULL
);

CREATE TABLE stock_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userid VARCHAR(255) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    side ENUM('LONG', 'SHORT') DEFAULT 'LONG',
    action VARCHAR(50) NOT NULL,
    amount BIGINT NOT NULL,
    price_per_share DECIMAL(18, 8) NOT NULL,
    total_cost BIGINT NOT NULL,
    pnl BIGINT DEFAULT 0,
    leverage INT DEFAULT 1,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE gamestatus (
    userid VARCHAR(255) NOT NULL PRIMARY KEY,
    luckyslot INT DEFAULT 1
);
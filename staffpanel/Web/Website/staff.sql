-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Server version:               10.5.9-MariaDB - mariadb.org binary distribution
-- Server OS:                    Win64
-- HeidiSQL Version:             11.0.0.5919
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;

-- Dumping structure for table portal.bans
CREATE TABLE IF NOT EXISTS `bans` (
  `bid` int(11) NOT NULL AUTO_INCREMENT,
  `id` varchar(20) NOT NULL,
  `staff` varchar(20) NOT NULL,
  `staffname` varchar(255) NOT NULL,
  `playername` varchar(255) NOT NULL,
  `reason` text NOT NULL,
  `length` bigint(255) NOT NULL,
  `appealed` tinyint(1) NOT NULL DEFAULT 0,
  `date` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`bid`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Data exporting was unselected.

-- Dumping structure for table portal.commends
CREATE TABLE IF NOT EXISTS `commends` (
  `cid` int(11) NOT NULL AUTO_INCREMENT,
  `id` varchar(20) NOT NULL,
  `staff` varchar(20) NOT NULL,
  `staffname` varchar(255) NOT NULL,
  `playername` varchar(255) NOT NULL,
  `reason` text NOT NULL,
  `date` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`cid`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Data exporting was unselected.

-- Dumping structure for table portal.kicks
CREATE TABLE IF NOT EXISTS `kicks` (
  `kid` int(11) NOT NULL AUTO_INCREMENT,
  `id` varchar(20) NOT NULL,
  `staff` varchar(20) NOT NULL,
  `staffname` varchar(255) NOT NULL,
  `playername` varchar(255) NOT NULL,
  `reason` text NOT NULL,
  `appealed` tinyint(1) NOT NULL DEFAULT 0,
  `date` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`kid`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Data exporting was unselected.

-- Dumping structure for table portal.notes
CREATE TABLE IF NOT EXISTS `notes` (
  `nid` int(11) NOT NULL AUTO_INCREMENT,
  `id` varchar(20) NOT NULL,
  `staff` varchar(20) NOT NULL,
  `staffname` varchar(255) NOT NULL,
  `playername` varchar(255) NOT NULL,
  `note` text NOT NULL,
  `date` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`nid`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Data exporting was unselected.

-- Dumping structure for table portal.servers
CREATE TABLE IF NOT EXISTS `servers` (
  `identifier` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  UNIQUE KEY `identifier` (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Data exporting was unselected.

-- Dumping structure for table portal.users
CREATE TABLE IF NOT EXISTS `users` (
  `id` varchar(20) NOT NULL,
  `username` varchar(255) NOT NULL,
  `ingamename` varchar(255) NOT NULL DEFAULT 'None',
  `discriminator` varchar(4) NOT NULL,
  `avatar` varchar(50) NOT NULL,
  `playtime` bigint(255) NOT NULL DEFAULT 0,
  `identifiers` text NOT NULL DEFAULT '[]',
  UNIQUE KEY `id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Data exporting was unselected.

-- Dumping structure for table portal.warnings
CREATE TABLE IF NOT EXISTS `warnings` (
  `wid` int(11) NOT NULL AUTO_INCREMENT,
  `id` varchar(20) NOT NULL,
  `staff` varchar(20) NOT NULL,
  `staffname` varchar(255) NOT NULL,
  `playername` varchar(255) NOT NULL,
  `reason` text NOT NULL,
  `appealed` tinyint(1) NOT NULL DEFAULT 0,
  `date` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`wid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Data exporting was unselected.

/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IF(@OLD_FOREIGN_KEY_CHECKS IS NULL, 1, @OLD_FOREIGN_KEY_CHECKS) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;

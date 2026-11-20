-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 12, 2026 at 04:18 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `sakit_learn`
--

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `id_category` int(11) NOT NULL,
  `nama_kategori` varchar(50) NOT NULL,
  `encoding_value` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`id_category`, `nama_kategori`, `encoding_value`) VALUES
(1, 'Underweight', 0),
(2, 'Normal', 1),
(3, 'Overweight', 2),
(4, 'Obesity', 3);

-- --------------------------------------------------------

--
-- Table structure for table `feedback`
--

CREATE TABLE `feedback` (
  `id_feedback` int(11) NOT NULL,
  `id_prediction` int(11) NOT NULL,
  `is_accurate` tinyint(1) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `predictions`
--

CREATE TABLE `predictions` (
  `id_prediction` int(11) NOT NULL,
  `id_user` int(11) NOT NULL,
  `id_category` int(11) NOT NULL,
  `features` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`features`)),
  `predicted_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `prediction_probabilities`
--

CREATE TABLE `prediction_probabilities` (
  `id_probability` int(11) NOT NULL,
  `id_prediction` int(11) NOT NULL,
  `id_category` int(11) NOT NULL,
  `probability` float NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id_user` int(11) NOT NULL,
  `nama_lengkap` varchar(100) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id_user`, `nama_lengkap`, `username`, `password`, `created_at`) VALUES
(1, 'Andi Pratama', 'andi', '123', '2026-10-08 03:42:03'),
(2, 'Budi Santoso', 'budi', '123', '2026-10-08 03:42:03');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id_category`),
  ADD UNIQUE KEY `nama_kategori` (`nama_kategori`);

--
-- Indexes for table `feedback`
--
ALTER TABLE `feedback`
  ADD PRIMARY KEY (`id_feedback`),
  ADD UNIQUE KEY `id_prediction` (`id_prediction`);

--
-- Indexes for table `predictions`
--
ALTER TABLE `predictions`
  ADD PRIMARY KEY (`id_prediction`),
  ADD KEY `fk_pred_user` (`id_user`),
  ADD KEY `fk_pred_category` (`id_category`);

--
-- Indexes for table `prediction_probabilities`
--
ALTER TABLE `prediction_probabilities`
  ADD PRIMARY KEY (`id_probability`),
  ADD KEY `fk_prob_pred` (`id_prediction`),
  ADD KEY `fk_prob_category` (`id_category`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id_user`),
  ADD UNIQUE KEY `username` (`username`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `id_category` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `feedback`
--
ALTER TABLE `feedback`
  MODIFY `id_feedback` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `predictions`
--
ALTER TABLE `predictions`
  MODIFY `id_prediction` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `prediction_probabilities`
--
ALTER TABLE `prediction_probabilities`
  MODIFY `id_probability` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id_user` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `feedback`
--
ALTER TABLE `feedback`
  ADD CONSTRAINT `fk_feedback_pred` FOREIGN KEY (`id_prediction`) REFERENCES `predictions` (`id_prediction`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `predictions`
--
ALTER TABLE `predictions`
  ADD CONSTRAINT `fk_pred_category` FOREIGN KEY (`id_category`) REFERENCES `categories` (`id_category`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_pred_user` FOREIGN KEY (`id_user`) REFERENCES `users` (`id_user`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `prediction_probabilities`
--
ALTER TABLE `prediction_probabilities`
  ADD CONSTRAINT `fk_prob_category` FOREIGN KEY (`id_category`) REFERENCES `categories` (`id_category`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_prob_pred` FOREIGN KEY (`id_prediction`) REFERENCES `predictions` (`id_prediction`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

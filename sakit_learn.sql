-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 08, 2026 at 05:44 AM
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
-- Table structure for table `activity_levels`
--

CREATE TABLE `activity_levels` (
  `id_activity` int(11) NOT NULL,
  `level` int(11) NOT NULL,
  `deskripsi` varchar(100) DEFAULT NULL,
  `encoding_value` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `activity_levels`
--

INSERT INTO `activity_levels` (`id_activity`, `level`, `deskripsi`, `encoding_value`) VALUES
(1, 1, 'Sangat jarang berolahraga', 0),
(2, 2, 'Jarang berolahraga', 1),
(3, 3, 'Sering berolahraga', 2),
(4, 4, 'Sangat sering berolahraga', 3);

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
(2, 'Normal weight', 1),
(3, 'Overweight', 2),
(4, 'Obese', 3);

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

--
-- Dumping data for table `feedback`
--

INSERT INTO `feedback` (`id_feedback`, `id_prediction`, `is_accurate`, `created_at`) VALUES
(1, 1, 1, '2026-10-08 03:42:03'),
(2, 2, 1, '2026-10-08 03:42:03'),
(3, 3, 0, '2026-10-08 03:42:03'),
(4, 4, 1, '2026-10-08 03:42:03'),
(5, 5, 1, '2026-10-08 03:42:03');

-- --------------------------------------------------------

--
-- Table structure for table `genders`
--

CREATE TABLE `genders` (
  `id_gender` int(11) NOT NULL,
  `nama_gender` varchar(20) NOT NULL,
  `encoding_value` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `genders`
--

INSERT INTO `genders` (`id_gender`, `nama_gender`, `encoding_value`) VALUES
(1, 'Male', 1),
(2, 'Female', 0);

-- --------------------------------------------------------

--
-- Table structure for table `predictions`
--

CREATE TABLE `predictions` (
  `id_prediction` int(11) NOT NULL,
  `id_user` int(11) NOT NULL,
  `id_category` int(11) NOT NULL,
  `id_gender` int(11) NOT NULL,
  `id_activity` int(11) NOT NULL,
  `age` int(11) NOT NULL,
  `height` float NOT NULL,
  `weight` float NOT NULL,
  `predicted_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `predictions`
--

INSERT INTO `predictions` (`id_prediction`, `id_user`, `id_category`, `id_gender`, `id_activity`, `age`, `height`, `weight`, `predicted_at`) VALUES
(1, 1, 2, 1, 4, 56, 173, 71, '2026-10-08 03:42:03'),
(2, 1, 3, 1, 3, 32, 168, 84, '2026-10-08 03:42:03'),
(3, 1, 4, 1, 2, 69, 164, 89, '2026-10-08 03:42:03'),
(4, 2, 1, 1, 2, 70, 178, 57, '2026-10-08 03:42:03'),
(5, 2, 2, 2, 3, 57, 150, 51, '2026-10-08 03:42:03'),
(6, 2, 3, 2, 4, 46, 168, 72, '2026-10-08 03:42:03');

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

--
-- Dumping data for table `prediction_probabilities`
--

INSERT INTO `prediction_probabilities` (`id_probability`, `id_prediction`, `id_category`, `probability`) VALUES
(1, 1, 1, 0.1),
(2, 1, 2, 0.78),
(3, 1, 3, 0.1),
(4, 1, 4, 0.02),
(5, 2, 1, 0.05),
(6, 2, 2, 0.2),
(7, 2, 3, 0.68),
(8, 2, 4, 0.07),
(9, 3, 1, 0.01),
(10, 3, 2, 0.04),
(11, 3, 3, 0.15),
(12, 3, 4, 0.8),
(13, 4, 1, 0.82),
(14, 4, 2, 0.12),
(15, 4, 3, 0.04),
(16, 4, 4, 0.02),
(17, 5, 1, 0.08),
(18, 5, 2, 0.8),
(19, 5, 3, 0.09),
(20, 5, 4, 0.03),
(21, 6, 1, 0.03),
(22, 6, 2, 0.17),
(23, 6, 3, 0.72),
(24, 6, 4, 0.08);

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
-- Indexes for table `activity_levels`
--
ALTER TABLE `activity_levels`
  ADD PRIMARY KEY (`id_activity`),
  ADD UNIQUE KEY `level` (`level`);

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
-- Indexes for table `genders`
--
ALTER TABLE `genders`
  ADD PRIMARY KEY (`id_gender`),
  ADD UNIQUE KEY `nama_gender` (`nama_gender`);

--
-- Indexes for table `predictions`
--
ALTER TABLE `predictions`
  ADD PRIMARY KEY (`id_prediction`),
  ADD KEY `fk_pred_user` (`id_user`),
  ADD KEY `fk_pred_category` (`id_category`),
  ADD KEY `fk_pred_gender` (`id_gender`),
  ADD KEY `fk_pred_activity` (`id_activity`);

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
-- AUTO_INCREMENT for table `activity_levels`
--
ALTER TABLE `activity_levels`
  MODIFY `id_activity` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `id_category` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `feedback`
--
ALTER TABLE `feedback`
  MODIFY `id_feedback` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `genders`
--
ALTER TABLE `genders`
  MODIFY `id_gender` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `predictions`
--
ALTER TABLE `predictions`
  MODIFY `id_prediction` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `prediction_probabilities`
--
ALTER TABLE `prediction_probabilities`
  MODIFY `id_probability` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

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
  ADD CONSTRAINT `fk_pred_activity` FOREIGN KEY (`id_activity`) REFERENCES `activity_levels` (`id_activity`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_pred_category` FOREIGN KEY (`id_category`) REFERENCES `categories` (`id_category`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_pred_gender` FOREIGN KEY (`id_gender`) REFERENCES `genders` (`id_gender`) ON UPDATE CASCADE,
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

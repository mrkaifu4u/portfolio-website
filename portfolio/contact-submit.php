<?php
// Contact Form Submission Handler with Redirect
// This version works with InfinityFree's bot protection

// Database configuration
$host = 'sql313.infinityfree.com';
$username = 'if0_41101023';
$password = 'xIqqtsvQioW';
$database = 'if0_41101023_contact_messages';

// Get the referring page (where the form is)
$redirect_url = isset($_SERVER['HTTP_REFERER']) ? $_SERVER['HTTP_REFERER'] : 'index.html';

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header("Location: $redirect_url");
    exit();
}

// Create connection
$conn = new mysqli($host, $username, $password, $database);

// Check connection
if ($conn->connect_error) {
    header("Location: $redirect_url?error=connection");
    exit();
}

// Get POST data
$name = isset($_POST['name']) ? trim($_POST['name']) : '';
$email = isset($_POST['email']) ? trim($_POST['email']) : '';
$message = isset($_POST['message']) ? trim($_POST['message']) : '';

// Validate input
if (empty($name) || empty($email) || empty($message)) {
    header("Location: $redirect_url?error=missing_fields");
    $conn->close();
    exit();
}

// Validate email
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    header("Location: $redirect_url?error=invalid_email");
    $conn->close();
    exit();
}

// Validate lengths
if (strlen($name) < 2 || strlen($name) > 255) {
    header("Location: $redirect_url?error=invalid_name");
    $conn->close();
    exit();
}

if (strlen($message) < 10 || strlen($message) > 5000) {
    header("Location: $redirect_url?error=invalid_message");
    $conn->close();
    exit();
}

// Prepare and execute SQL statement
$stmt = $conn->prepare("INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)");

if (!$stmt) {
    header("Location: $redirect_url?error=database");
    $conn->close();
    exit();
}

$stmt->bind_param("sss", $name, $email, $message);

if ($stmt->execute()) {
    // Success - redirect back with success parameter
    header("Location: $redirect_url?success=true");
} else {
    // Error - redirect back with error parameter
    header("Location: $redirect_url?error=submit_failed");
}

$stmt->close();
$conn->close();
exit();
?>

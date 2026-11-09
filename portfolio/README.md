# Portfolio Website

A modern, professional single-page portfolio website with smooth scrolling navigation, stunning black/white/red color scheme, and backend-ready contact form.

## Features

✨ **Modern Design**
- Clean, minimal, professional UI
- Black background with white text and red accents
- Smooth animations and hover effects
- Fully responsive (desktop, tablet, mobile)

🎯 **Single Page Navigation**
- Fixed top navigation bar
- Smooth scroll to sections
- Active link highlighting
- Mobile-friendly hamburger menu

📋 **Sections**
- **About**: Professional introduction and summary
- **Skills**: Technical skills organized by category (Programming, Frameworks, Tools)
- **Experience**: Timeline-based work history
- **Projects**: Portfolio projects with tech stack and links
- **Education**: Academic background
- **Contact**: Form with validation and database integration

🚀 **Interactive Features**
- Scroll-triggered fade-in and slide-in animations
- Hover effects on all interactive elements
- Form validation with error messages
- Backend API integration ready

## Project Structure

```
portfolio/
├── index.html                  # Main HTML file
├── style.css                   # All styles and animations
├── script.js                   # JavaScript functionality
├── database_schema.sql         # SQL database schema
├── api_endpoint_example.js     # Backend API example
└── README.md                   # This file
```

## Quick Start

### Frontend Only (No Backend)

1. Simply open `index.html` in your browser
2. The website will work with all features except form submission
3. Form data will be logged to console in demo mode

### With Backend (Full Functionality)

#### Prerequisites
- Node.js (v14 or higher)
- MySQL database server

#### Setup Steps

1. **Set up the database**
   ```bash
   # Login to MySQL
   mysql -u root -p
   
   # Create database
   CREATE DATABASE portfolio_db;
   
   # Import schema
   mysql -u root -p portfolio_db < database_schema.sql
   ```

2. **Install backend dependencies**
   ```bash
   npm install express mysql2 body-parser cors dotenv
   ```

3. **Create `.env` file**
   ```env
   PORT=3000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=portfolio_db
   ```

4. **Start the backend server**
   ```bash
   node api_endpoint_example.js
   ```

5. **Update the API endpoint in `script.js`**
   - The form will now submit to `http://localhost:3000/api/contact`
   - Data will be stored in the MySQL database

## Customization

### Update Personal Information

Edit `index.html` to customize:
- Your name and role (About section)
- Skills and technologies
- Work experience
- Projects and links
- Education details

### Change Colors

Edit CSS variables in `style.css`:
```css
:root {
    --color-black: #000000;
    --color-white: #ffffff;
    --color-red: #ff0000;
}
```

### Modify Sections

Each section in `index.html` is clearly marked with comments:
```html
<!-- ===== Section Name Start ===== -->
...
<!-- ===== Section Name End ===== -->
```

## Browser Compatibility

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance

- Optimized CSS with minimal repaints
- Efficient scroll event handling
- Lazy-loaded animations
- Mobile-first responsive design

## Database Schema

The contact form stores submissions with:
- `id`: Auto-increment primary key
- `name`: Visitor's name
- `email`: Visitor's email
- `message`: Contact message
- `timestamp`: Submission time
- `created_at`: Record creation time

## API Endpoints

### POST `/api/contact`
Submit contact form data

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "message": "Hello!",
  "timestamp": "2026-02-08T01:54:51Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Contact form submitted successfully",
  "submissionId": 1
}
```

### GET `/api/contact/submissions`
Retrieve all submissions (admin only)

### GET `/api/health`
Check API status

## Security Notes

⚠️ **Important for Production:**
- Add rate limiting to prevent spam
- Implement CAPTCHA for form submission
- Sanitize all user inputs
- Use HTTPS for secure communication
- Add authentication for admin endpoints
- Set up proper CORS policies
- Use environment variables for sensitive data

## Optional Enhancements

- Add email notifications using Nodemailer
- Implement admin dashboard to view submissions
- Add dark/light mode toggle
- Include downloadable resume
- Add blog section
- Integrate Google Analytics
- Add social media links

## License

Free to use and modify for personal and commercial projects.

## Support

For issues or questions, please open an issue in the repository or contact through the website's contact form.

---

**Built with ❤️ using HTML, CSS, JavaScript, Node.js, and MySQL**

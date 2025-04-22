// public/js/age-check.js

document.addEventListener("DOMContentLoaded", function () {
    const hasAccess = localStorage.getItem("ageVerified");
  
    if (!hasAccess) {
      const isOldEnough = confirm("You must be 21+ to view this site. Are you of legal age?");
      if (isOldEnough) {
        localStorage.setItem("ageVerified", true);
      } else {
        alert("Sorry, you must be of legal age to access this site.");
        window.location.href = "https://www.responsibility.org/"; // redirect to a responsible drinking resource
      }
    }
  });
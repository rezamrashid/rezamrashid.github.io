// Validates your database connection endpoints securely
const projectUrl = "https://supabase.co";
const anonPublicKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2emlzcGltY2NxdGpydXJhanlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1NDEyMzYsImV4cCI6MjEwNDExNzIzNn0.xp_4SwRzM1yaYIp9hY0VHagOx4nSqE57k2_2W3NLlcc";
const supabaseClient = supabase.createClient(projectUrl, anonPublicKey);

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorDisplay = document.getElementById('authError');
    errorDisplay.classList.add('hidden');
    
    const inputEmail = document.getElementById('authEmail').value;
    const inputPassword = document.getElementById('authPassword').value;
    
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: inputEmail,
        password: inputPassword
    });

    if (error) {
        errorDisplay.innerText = error.message;
        errorDisplay.classList.remove('hidden');
    } else {
        // Redirects smoothly to your master processing matrix layer upon authorization
        window.location.href = "https://pages.dev" + data.session.access_token;
    }
});

// Lógica de Autenticação (Login e Cadastro)
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const cadastroForm = document.getElementById('cadastro-form');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const errorMessage = document.getElementById('error-message');

            const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });

            if (error) {
                errorMessage.textContent = error.message;
                errorMessage.classList.remove('hidden');
            } else {
                window.location.href = 'dashboard.html';
            }
        });
    }

    if (cadastroForm) {
        cadastroForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorMessage = document.getElementById('error-message');

            // 1. Criar usuário no Auth do Supabase
            const { data, error } = await window.supabaseClient.auth.signUp({ email, password });

            if (error) {
                errorMessage.textContent = error.message;
                errorMessage.classList.remove('hidden');
                return;
            }

            if (data?.user) {
                // 2. Criar perfil na nossa tabela pública correspondente
                const { error: profileError } = await window.supabaseClient
                    .from('profiles')
                    .insert([{ id: data.user.id, username: username }]);

                if (profileError) {
                    errorMessage.textContent = profileError.message;
                    errorMessage.classList.remove('hidden');
                } else {
                    alert('Cadastro realizado com sucesso! Verifique seu e-mail se necessário ou faça login.');
                    window.location.href = 'index.html';
                }
            }
        });
    }
});

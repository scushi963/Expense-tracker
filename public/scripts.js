document.addEventListener('DOMContentLoaded', function () {
    // Check if user is logged in and update UI accordingly
    const isLoggedIn = localStorage.getItem('loggedIn') === 'true';
    toggleSections(isLoggedIn);

    // Show the "Get Started" section (login or register) if not logged in
    if (!isLoggedIn) {
        showSection('get-started');
    } else {
        showSection('home'); // Show home section or any other default section for logged-in users
        loadExpenses(); // Load expenses for logged-in users
    }

    // Event Listeners
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Login form submission
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Registration form submission
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegistration);
    }

    // Logout button click
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Navigation: show registration form
    const registerLink = document.getElementById('register-link');
    if (registerLink) {
        registerLink.addEventListener('click', () => showForm('register-form'));
    }

    // Navigation: show login form
    const loginLink = document.getElementById('login-link');
    if (loginLink) {
        loginLink.addEventListener('click', () => showForm('login-form'));
    }

    // Add expense form submission
    const addExpenseForm = document.getElementById('add-expense-form');
    if (addExpenseForm) {
        addExpenseForm.addEventListener('submit', handleAddExpense);
    }

    // Handle click for restricted sections
    const restrictedSections = ['add-expense', 'expenses'];
    restrictedSections.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section) {
            section.addEventListener('click', () => {
                const isLoggedIn = localStorage.getItem('loggedIn') === 'true';
                if (!isLoggedIn) {
                    showNotification('Please log in to access this section.', 'error');
                    showSection('get-started');
                }
            });
        }
    });
}

// Handle login form submission
async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    console.log('Logging in:', { email }); // Log login attempt

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await response.json();

        console.log('Login response:', data); // Log response

        if (response.ok && data.token) {
            localStorage.setItem('loggedIn', 'true');
            localStorage.setItem('token', data.token); // Store the token
            showNotification('Login successful!', 'success');
            showSection('home'); // Redirect to home or any other section for logged-in users
            toggleSections(true); // Show sections accessible after login
            loadExpenses(); // Refresh expenses list
        } else {
            showNotification(data.message || 'Invalid email or password. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('An error occurred during login. Please try again.', 'error');
    }
}

// Handle registration form submission
async function handleRegistration(event) {
    event.preventDefault();
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    console.log('Registering user:', { username, email }); // Log registration attempt

    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password }),
        });
        const data = await response.json();

        console.log('Registration response:', data); // Log response

        if (response.ok && data.success) {
            showNotification(`Registration successful! Welcome, ${username}.`, 'success');
            showForm('login-form'); // Show login form after successful registration
        } else {
            showNotification(data.message || 'Registration failed. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showNotification('An error occurred during registration. Please try again.', 'error');
    }
}

// Handle logout
function handleLogout() {
    localStorage.setItem('loggedIn', 'false');
    localStorage.removeItem('token'); // Remove the token
    showNotification('Logged out successfully!', 'success');
    showSection('get-started'); // Show the "Get Started" section
    toggleSections(false); // Hide sections accessible only after login
}

// Handle adding a new expense
async function handleAddExpense(event) {
    event.preventDefault();

    const title = document.getElementById('title').value;
    const amount = document.getElementById('amount').value;
    const description = document.getElementById('description').value; // Ensure this field is used
    const date = document.getElementById('date').value;

    try {
        const response = await fetch('/add-expense', { // Ensure the route matches
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}` // Send the token with the request
            },
            body: JSON.stringify({ title, amount, description, date }) // Ensure the body matches
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showNotification('Expense added successfully!', 'success');
            document.getElementById('add-expense-form').reset();
            loadExpenses(); // Refresh the expenses list
        } else {
            showNotification(data.message || 'Failed to add expense. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Add Expense error:', error);
        showNotification('An error occurred while adding the expense. Please try again.', 'error');
    }
}

// Load and display expenses
async function loadExpenses() {
    try {
        const response = await fetch('/expenses', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}` // Send the token with the request
            }
        });

        const data = await response.json();

        if (response.ok && data.expenses) {
            const expensesList = document.getElementById('expenses-list');
            expensesList.innerHTML = ''; // Clear current list

            data.expenses.forEach(expense => {
                const expenseItem = document.createElement('div');
                expenseItem.className = 'expense-item';
                expenseItem.innerHTML = `
                    <h3>${expense.title}</h3>
                    <p>Amount: $${expense.amount}</p>
                    <p>Date: ${new Date(expense.date).toLocaleDateString()}</p>
                    <p>${expense.description}</p>
                    <button class="edit-expense-btn" data-id="${expense.id}">Edit</button>
                    <button class="delete-expense-btn" data-id="${expense.id}">Delete</button>
                `;
                expensesList.appendChild(expenseItem);
            });

            // Attach event listeners to edit and delete buttons
            document.querySelectorAll('.edit-expense-btn').forEach(button => {
                button.addEventListener('click', handleEditExpense);
            });

            document.querySelectorAll('.delete-expense-btn').forEach(button => {
                button.addEventListener('click', handleDeleteExpense);
            });
        } else {
            showNotification(data.message || 'Failed to load expenses.', 'error');
        }
    } catch (error) {
        console.error('Load Expenses error:', error);
        showNotification('An error occurred while loading expenses. Please try again.', 'error');
    }
}

// Handle editing an expense
async function handleEditExpense(event) {
    const expenseId = event.target.dataset.id;

    try {
        const response = await fetch(`/expenses/${expenseId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}` // Send the token with the request
            }
        });

        const data = await response.json();

        if (response.ok && data.expense) {
            document.getElementById('title').value = data.expense.title;
            document.getElementById('amount').value = data.expense.amount;
            document.getElementById('description').value = data.expense.description;
            document.getElementById('date').value = new Date(data.expense.date).toISOString().split('T')[0];
            
            // Update the form submission to handle editing
            const addExpenseForm = document.getElementById('add-expense-form');
            if (addExpenseForm) {
                addExpenseForm.removeEventListener('submit', handleAddExpense); // Remove previous listener
                addExpenseForm.addEventListener('submit', async function (event) {
                    event.preventDefault();

                    const updatedTitle = document.getElementById('title').value;
                    const updatedAmount = document.getElementById('amount').value;
                    const updatedDescription = document.getElementById('description').value;
                    const updatedDate = document.getElementById('date').value;

                    try {
                        const response = await fetch(`/expenses/${expenseId}`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${localStorage.getItem('token')}` // Send the token with the request
                            },
                            body: JSON.stringify({ title: updatedTitle, amount: updatedAmount, description: updatedDescription, date: updatedDate })
                        });

                        const data = await response.json();

                        if (response.ok && data.success) {
                            showNotification('Expense updated successfully!', 'success');
                            loadExpenses(); // Refresh the expenses list
                        } else {
                            showNotification(data.message || 'Failed to update expense. Please try again.', 'error');
                        }
                    } catch (error) {
                        console.error('Edit Expense error:', error);
                        showNotification('An error occurred while updating the expense. Please try again.', 'error');
                    }
                });
            }
        } else {
            showNotification(data.message || 'Failed to load expense details.', 'error');
        }
    } catch (error) {
        console.error('Edit Expense error:', error);
        showNotification('An error occurred while loading expense details. Please try again.', 'error');
    }
}

// Handle deleting an expense
async function handleDeleteExpense(event) {
    const expenseId = event.target.dataset.id;

    try {
        const response = await fetch(`/expenses/${expenseId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}` // Send the token with the request
            }
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showNotification('Expense deleted successfully!', 'success');
            loadExpenses(); // Refresh the expenses list
        } else {
            showNotification(data.message || 'Failed to delete expense. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Delete Expense error:', error);
        showNotification('An error occurred while deleting the expense. Please try again.', 'error');
    }
}

// Show and hide sections based on login status
function toggleSections(isLoggedIn) {
    const sectionsToToggle = ['add-expense', 'expenses'];
    sectionsToToggle.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section) {
            section.classList.toggle('hidden', !isLoggedIn);
        }
    });

    // Toggle visibility of "Get Started" section
    const getStartedSection = document.getElementById('get-started');
    if (getStartedSection) {
        getStartedSection.classList.toggle('hidden', isLoggedIn);
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.classList.toggle('hidden', !isLoggedIn);
    }
}

// Show notification
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerText = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Show specific form (login or register)
function showForm(formId) {
    const forms = document.querySelectorAll('.form-container form');
    forms.forEach(form => {
        form.classList.add('hidden');
    });

    const formToShow = document.getElementById(formId);
    if (formToShow) {
        formToShow.classList.remove('hidden');
    }
}

// Show specific section based on the user's action
function showSection(sectionId) {
    const sections = document.querySelectorAll('section');
    sections.forEach(section => {
        section.classList.add('hidden');
    });

    const sectionToShow = document.getElementById(sectionId);
    if (sectionToShow) {
        sectionToShow.classList.remove('hidden');
    }
}

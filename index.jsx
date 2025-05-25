import React, { useState, useEffect } from 'react';

// Utility function to get data from local storage
const getLocalStorageItem = (key, defaultValue) => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.error("Error parsing localStorage item:", key, error);
        return defaultValue;
    }
};

// Utility function to set data to local storage
const setLocalStorageItem = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error("Error setting localStorage item:", key, error);
    }
};

// Main App component for the Leave Approval System
function App() {
    // State to manage the currently logged-in user.
    // It will store an object like { username: '...', role: '...' } or null if not logged in.
    const [currentUser, setCurrentUser] = useState(getLocalStorageItem('currentUser', null));

    // State to manage all registered users.
    // Each user is an object like { username: '...', password: '...', role: '...' }
    const [users, setUsers] = useState(getLocalStorageItem('users', []));

    // State to manage all leave requests.
    // Each leave request is an object with details like id, user, reason, status, etc.
    const [leaves, setLeaves] = useState(getLocalStorageItem('leaves', []));

    // State for login/registration form inputs
    const [authUsername, setAuthUsername] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authRole, setAuthRole] = useState('student'); // New: State for selected role during registration
    const [isRegistering, setIsRegistering] = useState(false); // Toggle between login and register forms

    // State for the leave request form inputs
    const [reason, setReason] = useState('sick'); // Default reason
    const [otherReason, setOtherReason] = useState(''); // New: For custom reason if 'Other' is selected
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [numberOfDays, setNumberOfDays] = useState(0); // New: State to store calculated leave days
    const [teacherToApprove, setTeacherToApprove] = useState(''); // For student leaves

    // Hardcoded list of teachers for student leave requests (populated from registered teachers)
    const teachers = users.filter(user => user.role === 'teacher').map(user => user.username);

    // --- Persistence with localStorage ---
    useEffect(() => {
        setLocalStorageItem('currentUser', currentUser);
    }, [currentUser]);

    useEffect(() => {
        setLocalStorageItem('users', users);
    }, [users]);

    useEffect(() => {
        setLocalStorageItem('leaves', leaves);
    }, [leaves]);

    // --- Calculate Leave Days ---
    useEffect(() => {
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            // Calculate difference in milliseconds, then convert to days
            const diffTime = Math.abs(end - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end day
            setNumberOfDays(diffDays);
        } else {
            setNumberOfDays(0);
        }
    }, [startDate, endDate]);

    // --- Authentication Logic ---

    // Function to handle user registration
    const handleRegister = () => {
        if (!authUsername || !authPassword || !authRole) {
            showMessageBox('Registration Error', 'Please enter username, password, and select a role.');
            return;
        }

        if (users.some(user => user.username.toLowerCase() === authUsername.toLowerCase())) {
            showMessageBox('Registration Error', 'Username already exists. Please choose a different one.');
            return;
        }

        const newUser = { username: authUsername, password: authPassword, role: authRole };
        setUsers([...users, newUser]);
        showMessageBox('Success', `User "${authUsername}" registered as a ${authRole}. You can now log in.`);
        setAuthUsername('');
        setAuthPassword('');
        setAuthRole('student'); // Reset role selection
        setIsRegistering(false); // Switch back to login form
    };

    // Function to handle user login
    const handleLogin = () => {
        if (!authUsername || !authPassword) {
            showMessageBox('Login Error', 'Please enter both username and password.');
            return;
        }

        const foundUser = users.find(
            user => user.username.toLowerCase() === authUsername.toLowerCase() && user.password === authPassword
        );

        if (foundUser) {
            setCurrentUser(foundUser);
            showMessageBox('Success', `Logged in as ${foundUser.username} (${foundUser.role}).`);
            setAuthUsername('');
            setAuthPassword('');
        } else {
            showMessageBox('Login Error', 'Invalid username or password.');
        }
    };

    // Function to handle user logout
    const handleLogout = () => {
        setCurrentUser(null);
        setReason('sick'); // Reset to default
        setOtherReason('');
        setStartDate('');
        setEndDate('');
        setNumberOfDays(0);
        setTeacherToApprove('');
        showMessageBox('Logged Out', 'You have been successfully logged out.');
    };

    // --- Leave Management Logic ---

    // Function to handle submitting a new leave request
    const requestLeave = () => {
        const finalReason = reason === 'other' ? otherReason : reason;

        if (!finalReason || !startDate || !endDate || (currentUser.role === 'student' && !teacherToApprove)) {
            showMessageBox('Leave Request Error', 'Please fill in all required leave request fields.');
            return;
        }
        if (reason === 'other' && !otherReason.trim()) {
            showMessageBox('Leave Request Error', 'Please specify the "Other Reason".');
            return;
        }
        if (numberOfDays <= 0) {
            showMessageBox('Leave Request Error', 'End date must be after or on the start date.');
            return;
        }

        // Generate a unique ID for the leave request
        const newLeaveId = Date.now().toString();

        // Create a new leave object based on the current user's role
        const newLeave = {
            id: newLeaveId,
            userName: currentUser.username,
            userRole: currentUser.role,
            reason: finalReason,
            startDate: startDate,
            endDate: endDate,
            numberOfDays: numberOfDays, // Store calculated days
            status: 'Pending', // Initial status
            // Teachers don't need teacher approval for their own leaves, only students do
            teacherApproved: currentUser.role === 'teacher' ? true : false,
            adminApproved: false,
            requestedToTeacher: currentUser.role === 'student' ? teacherToApprove : null, // Only for students
        };

        // Add the new leave request to the leaves array
        setLeaves([...leaves, newLeave]);

        // Clear the form fields after submission
        setReason('sick');
        setOtherReason('');
        setStartDate('');
        setEndDate('');
        setNumberOfDays(0);
        setTeacherToApprove('');
        showMessageBox('Success', 'Leave request submitted successfully!');
    };

    // Function to update the status of a leave request (approve/reject)
    const updateLeaveStatus = (leaveId, action, approverRole) => {
        setLeaves(prevLeaves =>
            prevLeaves.map(leave => {
                if (leave.id === leaveId) {
                    let updatedLeave = { ...leave };

                    if (approverRole === 'teacher') {
                        // Teacher approval logic
                        updatedLeave.teacherApproved = action === 'approve';
                        if (action === 'approve') {
                            updatedLeave.status = 'Approved by Teacher';
                        } else {
                            updatedLeave.status = 'Rejected by Teacher';
                            updatedLeave.adminApproved = false; // If teacher rejects, admin approval resets
                        }
                    } else if (approverRole === 'admin') {
                        // Admin approval logic
                        updatedLeave.adminApproved = action === 'approve';
                        if (action === 'approve') {
                            updatedLeave.status = 'Approved by Admin';
                        } else {
                            updatedLeave.status = 'Rejected by Admin';
                        }
                    }
                    return updatedLeave;
                }
                return leave;
            })
        );
        showMessageBox('Status Updated', `Leave request ${action === 'approve' ? 'approved' : 'rejected'}.`);
    };

    // --- Custom Message Box Logic (instead of alert) ---
    const [messageBox, setMessageBox] = useState({ visible: false, title: '', message: '' });

    const showMessageBox = (title, message) => {
        setMessageBox({ visible: true, title, message });
    };

    const hideMessageBox = () => {
        setMessageBox({ visible: false, title: '', message: '' });
    };

    // --- UI Rendering ---

    // If no user is logged in, show the login/registration page
    if (!currentUser) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
                {/* Tailwind CSS CDN */}
                <script src="https://cdn.tailwindcss.com"></script>
                {/* Inter font from Google Fonts */}
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
                <style>
                    {`
                    body {
                        font-family: 'Inter', sans-serif;
                    }
                    `}
                </style>

                <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
                    <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">
                        {isRegistering ? 'Register' : 'Login'}
                    </h2>
                    <p className="text-center text-gray-600 mb-4">
                        {isRegistering
                            ? 'Create a new account and select your role.'
                            : 'Log in to your account.'
                        }
                    </p>
                    <div className="mb-4">
                        <label htmlFor="authUsername" className="block text-gray-600 font-medium mb-2">Username:</label>
                        <input
                            type="text"
                            id="authUsername"
                            placeholder="Enter username"
                            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={authUsername}
                            onChange={(e) => setAuthUsername(e.target.value)}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    if (isRegistering) handleRegister();
                                    else handleLogin();
                                }
                            }}
                        />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="authPassword" className="block text-gray-600 font-medium mb-2">Password:</label>
                        <input
                            type="password"
                            id="authPassword"
                            placeholder="Enter password"
                            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={authPassword}
                            onChange={(e) => setAuthPassword(e.target.value)}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    if (isRegistering) handleRegister();
                                    else handleLogin();
                                }
                            }}
                        />
                    </div>
                    {isRegistering && (
                        <div className="mb-6">
                            <label htmlFor="authRole" className="block text-gray-600 font-medium mb-2">Select Role:</label>
                            <select
                                id="authRole"
                                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={authRole}
                                onChange={(e) => setAuthRole(e.target.value)}
                            >
                                <option value="student">Student</option>
                                <option value="teacher">Teacher</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                    )}
                    <button
                        onClick={isRegistering ? handleRegister : handleLogin}
                        className="w-full bg-blue-600 text-white p-3 rounded-md hover:bg-blue-700 transition duration-300 mb-4"
                    >
                        {isRegistering ? 'Register' : 'Login'}
                    </button>
                    <button
                        onClick={() => setIsRegistering(!isRegistering)}
                        className="w-full text-blue-600 p-3 rounded-md hover:bg-blue-50 transition duration-300"
                    >
                        {isRegistering ? 'Already have an account? Login' : 'New user? Register'}
                    </button>
                </div>

                {/* Custom Message Box */}
                {messageBox.visible && (
                    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center">
                            <h3 className="text-xl font-bold mb-3 text-gray-800">{messageBox.title}</h3>
                            <p className="text-gray-700 mb-5">{messageBox.message}</p>
                            <button
                                onClick={hideMessageBox}
                                className="bg-blue-600 text-white px-5 py-2 rounded-md hover:bg-blue-700 transition duration-300"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // If a user is logged in, show the dashboard
    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
            {/* Tailwind CSS CDN */}
            <script src="https://cdn.tailwindcss.com"></script>
            {/* Inter font from Google Fonts */}
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
            <style>
                {`
                body {
                    font-family: 'Inter', sans-serif;
                }
                `}
            </style>

            {/* Header */}
            <header className="bg-gradient-to-r from-blue-600 to-purple-700 text-white p-6 shadow-lg flex justify-between items-center rounded-b-xl">
                <h1 className="text-3xl font-bold">Leave Management Dashboard</h1>
                <div className="flex items-center space-x-4">
                    <span className="text-lg">Logged in as: <span className="font-semibold">{currentUser.username} ({currentUser.role})</span></span>
                    <button
                        onClick={handleLogout}
                        className="bg-white text-blue-600 px-4 py-2 rounded-full shadow-md hover:bg-gray-100 transition duration-300"
                    >
                        Logout
                    </button>
                </div>
            </header>

            <main className="p-8">
                {/* Leave Request Form (Visible to Student and Teacher) */}
                {(currentUser.role === 'student' || currentUser.role === 'teacher') && (
                    <section className="bg-white p-6 rounded-lg shadow-md mb-8">
                        <h2 className="text-2xl font-semibold text-gray-700 mb-4">Request New Leave</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label htmlFor="reasonSelect" className="block text-gray-600 font-medium mb-2">Reason:</label>
                                <select
                                    id="reasonSelect"
                                    className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                >
                                    <option value="sick">Sick Leave</option>
                                    <option value="casual">Casual Leave</option>
                                    <option value="vacation">Vacation</option>
                                    <option value="other">Other Reason</option>
                                </select>
                            </div>
                            {reason === 'other' && (
                                <div>
                                    <label htmlFor="otherReason" className="block text-gray-600 font-medium mb-2">Specify Other Reason:</label>
                                    <input
                                        type="text"
                                        id="otherReason"
                                        className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={otherReason}
                                        onChange={(e) => setOtherReason(e.target.value)}
                                        placeholder="e.g., Family emergency, Conference"
                                    />
                                </div>
                            )}
                            <div>
                                <label htmlFor="startDate" className="block text-gray-600 font-medium mb-2">Start Date:</label>
                                <input
                                    type="date"
                                    id="startDate"
                                    className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <label htmlFor="endDate" className="block text-gray-600 font-medium mb-2">End Date:</label>
                                <input
                                    type="date"
                                    id="endDate"
                                    className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                            <div className="col-span-1 md:col-span-2 lg:col-span-1">
                                <label className="block text-gray-600 font-medium mb-2">Number of Days:</label>
                                <p className="w-full p-3 bg-gray-100 border border-gray-300 rounded-md text-gray-700">
                                    {numberOfDays} {numberOfDays === 1 ? 'day' : 'days'}
                                </p>
                            </div>
                            {currentUser.role === 'student' && (
                                <div>
                                    <label htmlFor="teacherToApprove" className="block text-gray-600 font-medium mb-2">
                                        Request Approval From Teacher:
                                    </label>
                                    <select
                                        id="teacherToApprove"
                                        className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={teacherToApprove}
                                        onChange={(e) => setTeacherToApprove(e.target.value)}
                                    >
                                        <option value="">Select Teacher</option>
                                        {teachers.map((t, index) => (
                                            <option key={index} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={requestLeave}
                            className="mt-6 bg-green-600 text-white px-6 py-3 rounded-md shadow-md hover:bg-green-700 transition duration-300 font-semibold"
                        >
                            Submit Leave Request
                        </button>
                    </section>
                )}

                {/* My Leave Requests (Visible to Student and Teacher) */}
                {(currentUser.role === 'student' || currentUser.role === 'teacher') && (
                    <section className="bg-white p-6 rounded-lg shadow-md mb-8">
                        <h2 className="text-2xl font-semibold text-gray-700 mb-4">My Leave Requests</h2>
                        {leaves.filter(l => l.userName === currentUser.username).length === 0 ? (
                            <p className="text-gray-600">You have no leave requests yet.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
                                    <thead className="bg-gray-100 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                            {currentUser.role === 'student' && (
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher Approval</th>
                                            )}
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin Approval</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {leaves
                                            .filter(l => l.userName === currentUser.username)
                                            .map(leave => (
                                                <tr key={leave.id}>
                                                    <td className="px-6 py-4 whitespace-nowrap">{leave.reason}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">{leave.startDate} to {leave.endDate}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">{leave.numberOfDays}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold
                                                            ${leave.status.includes('Pending') ? 'bg-yellow-100 text-yellow-800' : ''}
                                                            ${leave.status.includes('Approved') ? 'bg-green-100 text-green-800' : ''}
                                                            ${leave.status.includes('Rejected') ? 'bg-red-100 text-red-800' : ''}
                                                        `}>
                                                            {leave.status}
                                                        </span>
                                                    </td>
                                                    {currentUser.role === 'student' && (
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            {leave.teacherApproved ? 'Approved' : 'Pending/Rejected'}
                                                            {leave.requestedToTeacher && ` (${leave.requestedToTeacher})`}
                                                        </td>
                                                    )}
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        {leave.adminApproved ? 'Approved' : 'Pending/Rejected'}
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                )}

                {/* Leaves for Teacher Approval (Visible to Teacher) */}
                {currentUser.role === 'teacher' && (
                    <section className="bg-white p-6 rounded-lg shadow-md mb-8">
                        <h2 className="text-2xl font-semibold text-gray-700 mb-4">Student Leaves for My Approval</h2>
                        {leaves.filter(l => l.userRole === 'student' && l.status.includes('Pending') && l.requestedToTeacher === currentUser.username).length === 0 ? (
                            <p className="text-gray-600">No student leaves pending your approval.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
                                    <thead className="bg-gray-100 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {leaves
                                            .filter(l => l.userRole === 'student' && l.status.includes('Pending') && l.requestedToTeacher === currentUser.username)
                                            .map(leave => (
                                                <tr key={leave.id}>
                                                    <td className="px-6 py-4 whitespace-nowrap">{leave.userName}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">{leave.reason}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">{leave.startDate} to {leave.endDate}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">{leave.numberOfDays}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <button
                                                            onClick={() => updateLeaveStatus(leave.id, 'approve', 'teacher')}
                                                            className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600 mr-2"
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={() => updateLeaveStatus(leave.id, 'reject', 'teacher')}
                                                            className="bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600"
                                                        >
                                                            Reject
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                )}

                {/* Leaves for Admin Approval (Visible to Admin, and Teacher leaves that are approved by teacher) */}
                {currentUser.role === 'admin' && (
                    <section className="bg-white p-6 rounded-lg shadow-md mb-8">
                        <h2 className="text-2xl font-semibold text-gray-700 mb-4">All Leaves for Admin Approval</h2>
                        {leaves.filter(l => !l.status.includes('Approved by Admin') && !l.status.includes('Rejected by Admin') && (l.userRole === 'teacher' || l.teacherApproved)).length === 0 ? (
                            <p className="text-gray-600">No leaves pending admin approval.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
                                    <thead className="bg-gray-100 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Status</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {leaves
                                            .filter(l => !l.status.includes('Approved by Admin') && !l.status.includes('Rejected by Admin') && (l.userRole === 'teacher' || l.teacherApproved))
                                            .map(leave => (
                                                <tr key={leave.id}>
                                                    <td className="px-6 py-4 whitespace-nowrap">{leave.userName}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">{leave.userRole}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">{leave.reason}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">{leave.startDate} to {leave.endDate}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">{leave.numberOfDays}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold
                                                            ${leave.status.includes('Pending') ? 'bg-yellow-100 text-yellow-800' : ''}
                                                            ${leave.status.includes('Approved by Teacher') ? 'bg-green-100 text-green-800' : ''}
                                                            ${leave.status.includes('Rejected') ? 'bg-red-100 text-red-800' : ''}
                                                        `}>
                                                            {leave.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <button
                                                            onClick={() => updateLeaveStatus(leave.id, 'approve', 'admin')}
                                                            className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600 mr-2"
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={() => updateLeaveStatus(leave.id, 'reject', 'admin')}
                                                            className="bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600"
                                                        >
                                                            Reject
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                )}

                {/* All Leave Requests (Visible to Admin for overview) */}
                {currentUser.role === 'admin' && (
                    <section className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-2xl font-semibold text-gray-700 mb-4">All Leave Requests (Overview)</h2>
                        {leaves.length === 0 ? (
                            <p className="text-gray-600">No leave requests have been submitted yet.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
                                    <thead className="bg-gray-100 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher Approval</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin Approval</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Final Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {leaves.map(leave => (
                                            <tr key={leave.id}>
                                                <td className="px-6 py-4 whitespace-nowrap">{leave.userName}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">{leave.userRole}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">{leave.reason}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">{leave.startDate} to {leave.endDate}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">{leave.numberOfDays}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {leave.userRole === 'student' ? (leave.teacherApproved ? 'Approved' : 'Pending/Rejected') : 'N/A'}
                                                    {leave.requestedToTeacher && leave.userRole === 'student' && ` (${leave.requestedToTeacher})`}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {leave.adminApproved ? 'Approved' : 'Pending/Rejected'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold
                                                        ${leave.status.includes('Pending') ? 'bg-yellow-100 text-yellow-800' : ''}
                                                        ${leave.status.includes('Approved') ? 'bg-green-100 text-green-800' : ''}
                                                        ${leave.status.includes('Rejected') ? 'bg-red-100 text-red-800' : ''}
                                                    `}>
                                                        {leave.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                )}
            </main>

            {/* Custom Message Box */}
            {messageBox.visible && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center">
                        <h3 className="text-xl font-bold mb-3 text-gray-800">{messageBox.title}</h3>
                        <p className="text-gray-700 mb-5">{messageBox.message}</p>
                        <button
                            onClick={hideMessageBox}
                            className="bg-blue-600 text-white px-5 py-2 rounded-md hover:bg-blue-700 transition duration-300"
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;

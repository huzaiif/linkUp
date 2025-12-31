var settingsmenu = document.querySelector(".settings-menu");
var darkbtn = document.getElementById("darkbtn")

if (settingsmenu) {
    function settingsMenuToggle() {
        settingsmenu.classList.toggle("settings-menu-height")
    }
}

if (darkbtn) {
    darkbtn.onclick = function () {
        darkbtn.classList.toggle("darkbtn-on");
        document.body.classList.toggle("dark-theme")
        if (localStorage.getItem("theme") == "light") {
            localStorage.setItem("theme", "dark")
        }
        else {
            localStorage.setItem("theme", "light")
        }
    }

    if (localStorage.getItem("theme") == "light") {
        darkbtn.classList.remove("darkbtn-on")
        document.body.classList.remove("dark-theme")
    }
    else {
        // Default to Dark Mode (if 'dark' or null)
        localStorage.setItem("theme", "dark")
        darkbtn.classList.add("darkbtn-on")
        document.body.classList.add("dark-theme")
    }
}



// Authentication Logic

// Auth & Social Logic

const API_URL = "";
let currentUserData = null;

async function register(name, email, password) {
    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await response.json();
        if (response.ok) {
            alert("Registration successful! Please log in.");
            window.location.href = "login.html";
        } else {
            console.log(data);
            alert(data.message || "Registration failed: " + response.statusText);
        }
    } catch (error) {
        console.error("Error:", error);
        alert("Request failed. Is the server running? Check console for details.");
    }
}

async function login(email, password) {
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem("currentUser", JSON.stringify(data.user));
            window.location.href = "index.html";
        } else {
            alert(data.message || "Login failed");
        }
    } catch (error) {
        console.error("Error:", error);
        alert("Network error");
    }
}

function logout() {
    localStorage.removeItem("currentUser");
    window.location.href = "login.html";
}

function guestLogin() {
    const guestUser = {
        id: "guest",
        name: "Guest User",
        email: "guest@example.com",
        profile_pic: "images/profile-pic.jpg"
    };
    localStorage.setItem("currentUser", JSON.stringify(guestUser));
    window.location.href = "index.html";
}

function checkAuth() {
    const userStr = localStorage.getItem("currentUser");
    if (!userStr) {
        window.location.href = "login.html";
    } else {
        currentUserData = JSON.parse(userStr);

        // Guest Restriction
        if (currentUserData.id === "guest") {
            const path = window.location.pathname;
            if (path.includes("profile.html") || path.includes("messages.html") || path.includes("notifications.html")) {
                alert("You need to login first to access this page!");
                window.location.href = "login.html";
                return;
            }
        }

        loadUserProfile();
        if (window.location.pathname.includes("profile.html") || window.location.pathname.includes("index.html")) {
            fetchPosts(1);
        }
    }
}

function loadUserProfile() {
    if (currentUserData) {
        document.querySelectorAll(".user-name-display").forEach(el => el.innerText = currentUserData.name);
        if (currentUserData.profile_pic && currentUserData.profile_pic !== "images/profile-pic.jpg") {
            updateUserPicElements(currentUserData.profile_pic);
        }
        const postInput = document.getElementById("post-content");
        if (postInput) {
            postInput.placeholder = `What's on your mind, ${currentUserData.name.split(' ')[0]}?`;
        }
    }
}

function updateUserPicElements(url) {
    document.querySelectorAll(".user-pic-display").forEach(el => {
        if (el.tagName === "I") {
            // Convert Icon to Image
            const img = document.createElement("img");
            img.src = url;
            img.className = el.className; // Keep existing classes

            // Extract size from font-size to set width/height
            const fontSize = el.style.fontSize;
            if (fontSize) {
                img.style.width = fontSize;
                img.style.height = fontSize;
            } else {
                img.style.width = "40px"; // Default fallback
                img.style.height = "40px";
            }

            img.style.borderRadius = "50%";
            img.style.objectFit = "cover";
            img.style.marginRight = el.style.marginRight;
            img.style.cursor = el.style.cursor;

            el.parentNode.replaceChild(img, el);
        } else if (el.tagName === "IMG") {
            // Just update src
            el.src = url;
        }
    });
}

async function uploadProfilePic(file) {
    if (!file) return;

    if (!currentUserData) {
        alert("Please login first");
        return;
    }

    const formData = new FormData();
    formData.append('profile_pic', file);
    formData.append('user_id', currentUserData.id);

    try {
        const response = await fetch(`${API_URL}/upload-profile-pic`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        if (response.ok) {
            // Update local state
            currentUserData.profile_pic = data.profile_pic;
            localStorage.setItem("currentUser", JSON.stringify(currentUserData));

            // Update UI immediately
            updateUserPicElements(data.profile_pic);
            alert("Profile picture updated!");
        } else {
            alert(data.message || "Upload failed");
        }
    } catch (error) {
        console.error(error);
        alert("Upload error");
    }
}

// --- Social Features ---

// Pagination State
let currentPage = 1;
const limit = 5;
let isLoading = false;

async function fetchPosts(page = 1) {
    if (isLoading) return;
    isLoading = true;

    try {
        let url = `${API_URL}/posts?page=${page}&limit=${limit}`;
        if (window.location.pathname.includes("profile.html") && currentUserData && currentUserData.id) {
            url += `&userId=${currentUserData.id}`;
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch posts");
        const posts = await response.json();

        if (posts.length < limit) {
            const loadMoreBtn = document.querySelector(".load-more-button");
            if (loadMoreBtn) loadMoreBtn.style.display = "none";
        }

        renderFeed(posts, page > 1);
        currentPage = page;
    } catch (error) {
        console.error(error);
    } finally {
        isLoading = false;
    }
}



// Load More Listener
document.addEventListener("DOMContentLoaded", () => {
    const loadMoreBtn = document.querySelector(".load-more-button");
    if (loadMoreBtn) {
        loadMoreBtn.onclick = () => {
            fetchPosts(currentPage + 1);
        };
    }
});

function renderFeed(posts, append = false) {
    const container = document.getElementById("feed-container");
    if (!container) return;

    if (!append) {
        container.innerHTML = "";
    }

    posts.forEach(post => {
        const date = new Date(post.created_at).toLocaleString();
        let deleteBtn = '';
        if (currentUserData && post.user_id === currentUserData.id) {
            deleteBtn = `<i class="fas fa-trash" onclick="deletePost(${post.id})" style="position: absolute; top: 20px; right: 20px; cursor: pointer; color: #ff5252;"></i>`;
        }

        const postHtml = `
            <div class="post-container" style="position: relative;">
                ${deleteBtn}
                <div class="post-row">
                    <div class="user-profile">
                        <img src="${post.user_pic || 'images/profile-pic.png'}" class="user-pic-display">
                        <div>
                            <p>${post.user_name}</p>
                            <span>${date}</span>
                        </div>
                    </div>
                </div>
                <p class="post-text">${post.content || ''}</p>
                ${post.image_url ? `<img src="${post.image_url}" class="post-image">` : ''}
                
                <div class="post-row">
                    <div class="activity-icons">
                        <div onclick="toggleLike(${post.id})" style="cursor:pointer;">
                            <img src="images/like-blue.png"> ${post.like_count}
                        </div>
                        <div onclick="toggleComments(${post.id})" style="cursor:pointer;">
                            <img src="images/comments.png"> ${post.comment_count}
                        </div>
                    </div>
                </div>
                <div id="comments-section-${post.id}" style="display:none; margin-top:10px; border-top:1px solid #eee; padding-top:10px;">
                    <div id="comments-list-${post.id}"></div>
                    <div style="display:flex; margin-top:10px;">
                        <input type="text" id="comment-input-${post.id}" placeholder="Write a comment..." style="flex:1; border:1px solid #ccc; padding:5px; border-radius:3px;">
                        <button onclick="postComment(${post.id})" style="margin-left:5px; background:#1876f2; color:white; border:none; padding:5px 10px; border-radius:3px; cursor:pointer;">Send</button>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += postHtml;
    });
}

async function createPost() {
    const content = document.getElementById("post-content").value;
    const imageUrl = document.getElementById("post-image-url").value;

    if (!content && !imageUrl) return alert("Write something!");

    try {
        const response = await fetch(`${API_URL}/posts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUserData.id,
                content,
                image_url: imageUrl
            })
        });
        if (response.ok) {
            document.getElementById("post-content").value = "";
            document.getElementById("post-image-url").value = "";
            fetchPosts();
        } else {
            alert("Failed to create post");
        }
    } catch (error) {
        console.error(error);
        alert("Error creating post");
    }
}

async function toggleLike(postId) {
    try {
        const response = await fetch(`${API_URL}/posts/${postId}/like`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUserData.id })
        });
        if (response.ok) {
            fetchPosts(); // Refresh to show new count
        }
    } catch (error) {
        console.error(error);
    }
}

function toggleComments(postId) {
    const section = document.getElementById(`comments-section-${postId}`);
    if (section.style.display === "none") {
        section.style.display = "block";
        fetchComments(postId);
    } else {
        section.style.display = "none";
    }
}

async function fetchComments(postId) {
    try {
        const response = await fetch(`${API_URL}/posts/${postId}/comments`);
        const comments = await response.json();
        const list = document.getElementById(`comments-list-${postId}`);
        list.innerHTML = "";
        comments.forEach(c => {
            list.innerHTML += `
                <div style="margin-bottom:5px; font-size:13px;">
                    <strong>${c.user_name}</strong>: ${c.content}
                </div>
            `;
        });
    } catch (error) {
        console.error(error);
    }
}

async function postComment(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    const content = input.value;
    if (!content) return;

    try {
        const response = await fetch(`${API_URL}/posts/${postId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUserData.id,
                content
            })
        });
        if (response.ok) {
            input.value = "";
            fetchComments(postId);
            fetchPosts(); // Update comment count
        }
    } catch (error) {
        console.error(error);
    }
}

async function deletePost(postId) {
    if (!confirm("Are you sure you want to delete this post?")) return;

    if (!currentUserData) {
        alert("Please login first");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/posts/${postId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserData.id })
        });
        const data = await response.json();

        if (response.ok) {
            alert("Post deleted");
            // Refresh feed
            fetchPosts(currentPage);
        } else {
            alert(data.message || "Delete failed");
        }
    } catch (error) {
        console.error(error);
        alert("Delete error");
    }
}

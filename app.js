
import { initializeApp } from
  "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// Replace these values with your Firebase web app configuration.
const firebaseConfig = {
  apiKey: "AIzaSyAe8WEXVZG9OTDYZ-g1Z4FeOurlvFXEx9g",
  authDomain: "smartmeet-94a4a.firebaseapp.com",
  projectId: "smartmeet-94a4a",
  storageBucket: "smartmeet-94a4a.firebasestorage.app",
  messagingSenderId: "176794184802",
  appId: "1:176794184802:web:3077cb76195c1dd4aef53b"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const $ = (id) => document.getElementById(id);

let currentUser = null;
let contacts = [];
let encounters = [];
let isRegisterMode = false;
let busy = false;

function showMessage(id, message, error = false) {
  const element = $(id);
  element.textContent = message;
  element.classList.toggle("error", error);
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function contactsRef() {
  return collection(db, "users", currentUser.uid, "contacts");
}

function contactRef(contactId) {
  return doc(db, "users", currentUser.uid, "contacts", contactId);
}

function encountersRef(contactId) {
  return collection(
    db, "users", currentUser.uid, "contacts", contactId, "encounters"
  );
}

function encounterRef(contactId, encounterId) {
  return doc(
    db, "users", currentUser.uid, "contacts",
    contactId, "encounters", encounterId
  );
}

// Switch between login and registration.
$("switch-auth").addEventListener("click", () => {
  isRegisterMode = !isRegisterMode;

  $("auth-heading").textContent =
    isRegisterMode ? "Create your account" : "Welcome back";

  $("auth-subtitle").textContent =
    isRegisterMode
      ? "Register to start using SmartMeet."
      : "Log in to your SmartMeet account.";

  $("auth-submit").textContent =
    isRegisterMode ? "Create account" : "Log in";

  $("switch-label").textContent =
    isRegisterMode ? "Already registered?" : "New to SmartMeet?";

  $("switch-auth").textContent =
    isRegisterMode ? "Log in" : "Create account";

  $("name-field").classList.toggle("hidden", !isRegisterMode);
  $("auth-name").required = isRegisterMode;
  $("auth-password").autocomplete =
    isRegisterMode ? "new-password" : "current-password";

  showMessage("auth-message", "");
});

// Register or log in.
$("auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;

  const email = $("auth-email").value.trim();
  const password = $("auth-password").value;
  const name = $("auth-name").value.trim();

  busy = true;
  $("auth-submit").disabled = true;
  showMessage("auth-message", "Please wait...");

  try {
    if (isRegisterMode) {
      if (!name) throw new Error("Please enter your name.");

      const credential = await createUserWithEmailAndPassword(
        auth, email, password
      );

      await updateProfile(credential.user, {
        displayName: name
      });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }

    $("auth-form").reset();
    showMessage("auth-message", "");
  } catch (error) {
    showMessage("auth-message", error.message, true);
  } finally {
    busy = false;
    $("auth-submit").disabled = false;
  }
});

// Log out.
$("logout-btn").addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    alert("Unable to log out: " + error.message);
  }
});

// Observe Firebase login status.
onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  $("auth-section").classList.toggle("hidden", Boolean(user));
  $("app-section").classList.toggle("hidden", !user);
  $("logout-btn").classList.toggle("hidden", !user);

  $("user-label").textContent = user
    ? (user.displayName || user.email || "")
    : "";

  if (user) {
    await refreshData();
  } else {
    contacts = [];
    encounters = [];
    renderContacts();
    renderEncounters();
  }
});

// Load the user's contacts and their encounter records.
async function refreshData() {
  if (!currentUser) return;

  try {
    const contactSnapshot = await getDocs(contactsRef());

    contacts = contactSnapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    const allEncounters = await Promise.all(
      contacts.map(async (contact) => {
        const snapshot = await getDocs(encountersRef(contact.id));

        return snapshot.docs.map((item) => ({
          id: item.id,
          contactId: contact.id,
          contactName: contact.name,
          ...item.data()
        }));
      })
    );

    encounters = allEncounters.flat();

    encounters.sort((a, b) => {
      const dateA = `${a.date || ""}T${a.time || "00:00"}`;
      const dateB = `${b.date || ""}T${b.time || "00:00"}`;
      return dateB.localeCompare(dateA);
    });

    renderContacts();
    renderEncounters();
  } catch (error) {
    console.error(error);
    showMessage(
      "contact-message",
      "Unable to load cloud data. Check your Firebase setup and rules.",
      true
    );
  }
}

// Add or update a contact.
$("contact-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return;

  const id = $("contact-id").value;
  const name = $("contact-name").value.trim();

  if (!name) {
    showMessage("contact-message", "Contact name is required.", true);
    return;
  }

  const contactData = {
    name,
    organization: $("contact-organization").value.trim(),
    email: $("contact-email").value.trim(),
    notes: $("contact-notes").value.trim(),
    updatedAt: serverTimestamp()
  };

  try {
    if (id) {
      await updateDoc(contactRef(id), contactData);
      showMessage("contact-message", "Contact updated successfully.");
    } else {
      await addDoc(contactsRef(), {
        ...contactData,
        createdAt: serverTimestamp()
      });
      showMessage("contact-message", "Contact saved to the cloud.");
    }

    resetContactForm();
    await refreshData();
  } catch (error) {
    showMessage("contact-message", error.message, true);
  }
});

function resetContactForm() {
  $("contact-form").reset();
  $("contact-id").value = "";
  $("contact-form-title").textContent = "Add a contact";
  $("save-contact-btn").textContent = "Save contact";
  $("cancel-edit-btn").classList.add("hidden");
}

$("cancel-edit-btn").addEventListener("click", resetContactForm);

// Search contacts.
$("contact-search").addEventListener("input", renderContacts);

function renderContacts() {
  const list = $("contacts-list");
  const query = $("contact-search").value.trim().toLowerCase();

  const filtered = contacts.filter((contact) =>
    [contact.name, contact.organization, contact.email, contact.notes]
      .some((value) => String(value || "").toLowerCase().includes(query))
  );

  $("contact-count").textContent = contacts.length;
  $("encounter-count").textContent = encounters.length;

  $("encounter-contact").innerHTML =
    '<option value="">Select a contact</option>' +
    contacts.map((contact) =>
      `<option value="${escapeHTML(contact.id)}">${escapeHTML(contact.name)}</option>`
    ).join("");

  if (!filtered.length) {
    list.innerHTML = '<p class="muted">No matching contacts found.</p>';
    return;
  }

  list.innerHTML = filtered.map((contact) => `
    <article class="contact-card">
      <h3>${escapeHTML(contact.name)}</h3>
      <p>${escapeHTML(contact.organization || "No organization added")}</p>
      <p>${escapeHTML(contact.email || "")}</p>
      <p>${escapeHTML(contact.notes || "No notes")}</p>
      <div class="contact-actions">
        <button class="btn btn-light" data-action="edit"
          data-id="${escapeHTML(contact.id)}">Edit</button>
        <button class="btn btn-light" data-action="encounter"
          data-id="${escapeHTML(contact.id)}">Record meeting</button>
        <button class="btn btn-danger" data-action="delete"
          data-id="${escapeHTML(contact.id)}">Delete</button>
      </div>
    </article>
  `).join("");
}

// Handle contact card actions.
$("contacts-list").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const contact = contacts.find((item) => item.id === button.dataset.id);
  if (!contact) return;

  const action = button.dataset.action;

  if (action === "edit") {
    $("contact-id").value = contact.id;
    $("contact-name").value = contact.name || "";
    $("contact-organization").value = contact.organization || "";
    $("contact-email").value = contact.email || "";
    $("contact-notes").value = contact.notes || "";
    $("contact-form-title").textContent = "Edit contact";
    $("save-contact-btn").textContent = "Update contact";
    $("cancel-edit-btn").classList.remove("hidden");

    $("contact-form").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  if (action === "encounter") {
    $("encounter-contact").value = contact.id;
    $("encounter-form").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  if (action === "delete") {
    const confirmed = confirm(
      `Delete ${contact.name} and all of this contact's encounter records?`
    );
    if (!confirmed) return;

    try {
      // Firestore does not automatically delete subcollection documents.
      const snapshot = await getDocs(encountersRef(contact.id));

      for (const item of snapshot.docs) {
        await deleteDoc(encounterRef(contact.id, item.id));
      }

      await deleteDoc(contactRef(contact.id));
      showMessage("contact-message", "Contact deleted.");
      await refreshData();
    } catch (error) {
      showMessage("contact-message", error.message, true);
    }
  }
});

// Set default encounter date and time to the current local time.
function setDefaultEncounterTime() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  const value = local.toISOString();

  $("encounter-date").value = value.slice(0, 10);
  $("encounter-time").value = value.slice(11, 16);
}

setDefaultEncounterTime();

// Record an encounter under its contact.
$("encounter-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return;

  const contactId = $("encounter-contact").value;
  const contact = contacts.find((item) => item.id === contactId);

  if (!contact) {
    showMessage("encounter-message", "Please select a contact.", true);
    return;
  }

  const encounterData = {
    date: $("encounter-date").value,
    time: $("encounter-time").value,
    location: $("encounter-location").value.trim(),
    notes: $("encounter-notes").value.trim(),
    createdAt: serverTimestamp()
  };

  if (!encounterData.date || !encounterData.time) {
    showMessage("encounter-message", "Date and time are required.", true);
    return;
  }

  try {
    await addDoc(encountersRef(contactId), encounterData);
    $("encounter-form").reset();
    setDefaultEncounterTime();
    showMessage("encounter-message", "Encounter saved successfully.");
    await refreshData();
  } catch (error) {
    showMessage("encounter-message", error.message, true);
  }
});

// Display the latest encounters.
function renderEncounters() {
  const list = $("encounters-list");
  $("encounter-count").textContent = encounters.length;

  if (!encounters.length) {
    list.innerHTML = '<p class="muted">No encounters recorded yet.</p>';
    return;
  }

  list.innerHTML = encounters.slice(0, 20).map((item) => `
    <article class="encounter-card">
      <strong>${escapeHTML(item.contactName || "Contact")}</strong>
      <p>${escapeHTML(item.date || "")} at ${escapeHTML(item.time || "")}</p>
      <p>${escapeHTML(item.location || "Location not provided")}</p>
      <p>${escapeHTML(item.notes || "No meeting notes")}</p>
    </article>
  `).join("");
}

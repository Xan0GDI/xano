document.addEventListener('DOMContentLoaded', function() {
    // Initialize AOS library for scroll animations
    AOS.init({
        duration: 800,
        once: true
    });

    // --- Modal Logic ---

    // Get modal elements
    const modal = document.getElementById('projectModal');
    // If there is no modal on the page, do nothing.
    if (!modal) return;

    const closeButton = modal.querySelector('.close-button');
    const modalTitle = modal.querySelector('#modalTitle');
    const modalDescription = modal.querySelector('#modalDescription');
    const modalImage = modal.querySelector('#modalImage');
    const modalYoutubeContainer = modal.querySelector('.video-container');
    const modalYoutubeIframe = modal.querySelector('#modalYoutube');
    const projectCards = document.querySelectorAll('.card');

    projectCards.forEach(card => {
        card.addEventListener('click', () => {
            // Get data from the card's data-* attributes
            const title = card.dataset.title || 'Project Details';
            const description = card.dataset.description || 'No description available.';
            const image = card.dataset.image;
            const youtubeId = card.dataset.youtube;

            // Populate the modal with the data
            modalTitle.textContent = title;
            modalDescription.textContent = description;

            // Handle image visibility
            if (image) {
                modalImage.src = image;
                modalImage.style.display = 'block';
            } else {
                modalImage.style.display = 'none';
            }

            // Handle YouTube video visibility and source
            if (youtubeId) {
                modalYoutubeContainer.style.display = 'block';
                modalYoutubeIframe.src = `https://www.youtube.com/embed/${youtubeId}`;
            } else {
                modalYoutubeContainer.style.display = 'none';
                modalYoutubeIframe.src = '';
            }

            // Show the modal and prevent background scrolling
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        });
    });

    // Function to close the modal
    function closeModal() {
        modal.classList.remove('show');
        document.body.style.overflow = ''; // Restore scrolling

        // Stop the YouTube video from playing in the background after the animation
        setTimeout(() => {
            modalYoutubeIframe.src = '';
        }, 400); // This duration should match the CSS transition time
    }

    // Event listeners for closing the modal
    closeButton.addEventListener('click', closeModal);

    // Close by clicking the overlay background
    modal.addEventListener('click', (event) => {
        if (event.target === modal) closeModal();
    });

    // Close with the Escape key
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.classList.contains('show')) closeModal();
    });

    // --- Live Avatar Update Logic ---

    // Function to update Roblox avatar dynamically
    async function updateRobloxAvatar() {
        const robloxLink = document.querySelector('.contact-item[data-roblox-id]');
        if (!robloxLink) return; // Exit if Roblox link not found

        const robloxId = robloxLink.dataset.robloxId;
        const robloxAvatarImg = robloxLink.querySelector('#roblox-avatar');

        if (!robloxId || !robloxAvatarImg) return; // Exit if ID or image element not found

        const apiUrl = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxId}&size=48x48&format=Png&isCircular=false`;

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            if (data.data && data.data.length > 0 && data.data[0].imageUrl) {
                robloxAvatarImg.src = data.data[0].imageUrl;
            } else {
                console.warn('Roblox avatar not found or API response malformed.');
            }
        } catch (error) {
            console.error('Error fetching Roblox avatar:', error);
            // Fallback to the static image if there's an error
            robloxAvatarImg.src = 'static/avatar/roblox.png';
        }
    }

    // Call the avatar update function on page load
    updateRobloxAvatar();
});

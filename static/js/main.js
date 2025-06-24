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
        }, 400); // This duration should match the CSS transition time :O
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
});

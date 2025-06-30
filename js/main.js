document.addEventListener('DOMContentLoaded', function() {
    // Initialize AOS library for scroll animations
    AOS.init({
        duration: 600, // A bit snappier
        once: true
    });

    const body = document.body;
    const mobileNavToggle = document.querySelector('.mobile-nav-toggle');
    const navMenu = document.querySelector('.nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    const modal = document.getElementById('projectModal');
    const sections = document.querySelectorAll('section[id]');

    // --- Body Scroll Lock ---
    const lockScroll = () => {
        body.classList.add('no-scroll');
    };

    const unlockScroll = () => {
        // Only unlock if the modal isn't also open
        if (!modal.classList.contains('show')) {
            body.classList.remove('no-scroll');
        }
    };

    // --- Mobile Navigation Logic ---
    if (mobileNavToggle && navMenu) {
        mobileNavToggle.addEventListener('click', () => {
            navMenu.classList.toggle('open');
            mobileNavToggle.classList.toggle('open');
            if (navMenu.classList.contains('open')) {
                lockScroll();
            } else {
                unlockScroll();
            }
        });

        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (navMenu.classList.contains('open')) {
                    navMenu.classList.remove('open');
                    mobileNavToggle.classList.remove('open');
                    unlockScroll();
                }
            });
        });
    }

    // --- Modal Logic ---
    if (modal) {
        const closeButton = modal.querySelector('.close-button');
        const modalTitle = modal.querySelector('#modalTitle');
        const modalDescription = modal.querySelector('#modalDescription');
        const modalTechList = modal.querySelector('#modalTech');
        const modalYoutubeContainer = modal.querySelector('.video-container');
        const modalYoutubeIframe = modal.querySelector('#modalYoutube');
        const projectCards = document.querySelectorAll('.card');

        const openModal = (card) => {
            const title = card.dataset.title || 'Project Details';
            const description = card.dataset.description || 'No description available.';
            const tech = card.dataset.tech || '';
            const youtubeId = card.dataset.youtube;

            modalTitle.textContent = title;
            modalDescription.textContent = description;

            // Populate technologies
            modalTechList.innerHTML = '';
            if (tech) {
                tech.split(',').forEach(techName => {
                    const li = document.createElement('li');
                    li.textContent = techName.trim();
                    modalTechList.appendChild(li);
                });
            }

            modalYoutubeContainer.style.display = youtubeId ? 'block' : 'none';
            modalYoutubeIframe.src = youtubeId ? `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0` : '';

            modal.classList.add('show');
            lockScroll();
        };

        const closeModal = () => {
            modal.classList.remove('show');
            modalYoutubeIframe.src = ''; // Stop video
            // Only unlock if mobile menu isn't open
            if (!navMenu || !navMenu.classList.contains('open')) {
                unlockScroll();
            }
        };

        projectCards.forEach(card => {
            card.addEventListener('click', () => openModal(card));
        });

        closeButton.addEventListener('click', closeModal);
        modal.addEventListener('click', (event) => {
            if (event.target === modal) closeModal();
        });
    }

    // --- Active Nav Link on Scroll (Scrollspy) ---
    const scrollSpy = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const id = entry.target.getAttribute('id');
            const activeLink = document.querySelector(`.nav-menu a[href="#${id}"]`);
            if (entry.isIntersecting) {
                navLinks.forEach(link => link.classList.remove('active'));
                if (activeLink) {
                    activeLink.classList.add('active');
                }
            }
        });
    }, {
        // Trigger when the top of a section is in the top 25% of the viewport.
        // This is more reliable for the last section on the page.
        rootMargin: "0px 0px -75% 0px"
    });

    sections.forEach(section => scrollSpy.observe(section));

    // --- Observer for bottom of page to handle last nav item ---
    const bottomSentinel = document.getElementById('page-bottom-sentinel');
    if (bottomSentinel) {
        const bottomObserver = new IntersectionObserver((entries) => {
            // If the sentinel is intersecting, we are at the bottom of the page.
            if (entries[0].isIntersecting) {
                navLinks.forEach(link => link.classList.remove('active'));
                const lastLink = document.querySelector('.nav-menu li:last-child a');
                if (lastLink) {
                    lastLink.classList.add('active');
                }
            }
        }, { threshold: 1.0 }); // Trigger when the sentinel is fully visible.

        bottomObserver.observe(bottomSentinel);
    }

    // --- Global Keydown Listener ---
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            if (modal && modal.classList.contains('show')) {
                modal.querySelector('.close-button').click(); // Trigger close logic
            } else if (navMenu && navMenu.classList.contains('open')) {
                mobileNavToggle.click(); // Trigger close logic
            }
        }
    });
});
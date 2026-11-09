// Find our date picker inputs on the page
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');
const getImagesButton = document.querySelector('.filters button');
const gallery = document.getElementById('gallery');
const apodDialog = document.getElementById('apodDialog');
const dialogImage = document.getElementById('dialogImage');
const dialogTitle = document.getElementById('dialogTitle');
const dialogDate = document.getElementById('dialogDate');
const dialogExplanation = document.getElementById('dialogExplanation');
const dialogVideoLink = document.getElementById('dialogVideoLink');

// This key is visible in the browser because this app runs on the user's device.
const apiKey = 'MjCtkcmfrkbjfntWznfWDTgPrKNkjQ9QKkhqKcmQ';

// Call the setupDateInputs function from dateRange.js
// This sets up the date pickers to:
// - Default to a range of 9 days (from 9 days ago to today)
// - Restrict dates to NASA's image archive (starting from 1995)
setupDateInputs(startInput, endInput);

// Ask NASA for every APOD between the selected dates when the button is clicked.
getImagesButton.addEventListener('click', getSpaceImages);

async function getSpaceImages() {
	const startDate = startInput.value;
	const endDate = endInput.value;

	if (!startDate || !endDate) {
		gallery.textContent = 'Please choose both a start date and an end date.';
		return;
	}

	if (startDate > endDate) {
		gallery.textContent = 'The start date must be before the end date.';
		return;
	}

	// URLSearchParams safely adds the API key and selected dates to the URL.
	const query = new URLSearchParams({
		api_key: apiKey,
		start_date: startDate,
		end_date: endDate,
		thumbs: 'true'
	});
	const apiUrl = `https://api.nasa.gov/planetary/apod?${query}`;

	gallery.textContent = 'Loading space images...';
	getImagesButton.disabled = true;

	try {
		const response = await fetch(apiUrl);

		if (!response.ok) {
			throw new Error('NASA could not load these images. Please try again.');
		}

		const apodItems = await response.json();
		gallery.replaceChildren();

		apodItems.forEach((item) => {
			const card = document.createElement('article');
			card.className = 'gallery-item';
			card.setAttribute('role', 'button');
			card.setAttribute('aria-label', `Open details for ${item.title}, ${item.date}`);
			card.tabIndex = 0;

			const imageUrl = item.media_type === 'image' ? item.url : item.thumbnail_url;
			const largeImageUrl = item.hdurl || imageUrl;
			if (imageUrl) {
				const image = document.createElement('img');
				image.src = imageUrl;
				image.alt = item.title;
				card.appendChild(image);
			}

			const title = document.createElement('h2');
			title.textContent = item.title;
			card.appendChild(title);

			const date = document.createElement('p');
			date.textContent = item.date;
			card.appendChild(date);

			const explanation = document.createElement('p');
			explanation.textContent = item.explanation;
			card.appendChild(explanation);

			card.addEventListener('click', () => openApodDialog(item, largeImageUrl));
			card.addEventListener('keydown', (event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					openApodDialog(item, largeImageUrl);
				}
			});

			gallery.appendChild(card);
		});
	} catch (error) {
		gallery.textContent = error.message;
	} finally {
		getImagesButton.disabled = false;
	}
}

function openApodDialog(item, imageUrl) {
	if (imageUrl) {
		dialogImage.src = imageUrl;
		dialogImage.alt = item.title;
		dialogImage.hidden = false;
	} else {
		dialogImage.removeAttribute('src');
		dialogImage.hidden = true;
	}

	dialogTitle.textContent = item.title;
	dialogDate.textContent = item.date;
	dialogExplanation.textContent = item.explanation;
	dialogVideoLink.hidden = item.media_type !== 'video';
	if (item.media_type === 'video') {
		dialogVideoLink.href = item.url;
	}

	apodDialog.showModal();
}

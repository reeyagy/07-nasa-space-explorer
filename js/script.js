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
const spaceFact = document.getElementById('spaceFact');

// Pick one space fact each time the page loads.
const spaceFacts = [
	'Light from the Sun takes about 8 minutes and 20 seconds to reach Earth.',
	'A year on Mercury lasts just 88 Earth days.',
	'Saturn\'s rings are made mostly of pieces of water ice and rock.',
	'One day on Venus is longer than one Venus year.'
];
const randomFactIndex = Math.floor(Math.random() * spaceFacts.length);
spaceFact.textContent = spaceFacts[randomFactIndex];

// Use NASA's migrated APOD archive, which has distinct records for archived dates.
const archiveUrl = 'https://science.nasa.gov/wp-json/wp/v2/image-article';

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

	const loadingMessage = document.createElement('p');
	loadingMessage.className = 'loading-message';
	loadingMessage.setAttribute('role', 'status');
	loadingMessage.textContent = '🔄 Loading space photos…';
	gallery.replaceChildren(loadingMessage);
	gallery.setAttribute('aria-busy', 'true');
	getImagesButton.disabled = true;

	try {
		// The archive's "after" filter is exclusive, so step back one day to include the start date.
		const dayBeforeStart = new Date(`${startDate}T00:00:00Z`);
		dayBeforeStart.setUTCDate(dayBeforeStart.getUTCDate() - 1);
		const archiveRecords = [];
		let page = 1;
		let totalPages = 1;

		// NASA returns up to 100 archive records per page.
		while (page <= totalPages) {
			const query = new URLSearchParams({
				after: `${dayBeforeStart.toISOString().slice(0, 10)}T23:59:59`,
				before: `${endDate}T23:59:59`,
				per_page: '100',
				page: String(page),
				_fields: 'date,slug,title,content'
			});
			const response = await fetch(`${archiveUrl}?${query}`);
			const pageRecords = await response.json();

			if (!response.ok) {
				throw new Error(pageRecords.message || `NASA returned an error (${response.status}).`);
			}

			if (!Array.isArray(pageRecords)) {
				throw new Error('NASA returned data in an unexpected format. Please try again.');
			}

			if (page === 1) {
				const totalPagesHeader = response.headers.get('X-WP-TotalPages');
				totalPages = Number(totalPagesHeader);
				if (!totalPagesHeader || !Number.isInteger(totalPages) || totalPages < 0) {
					throw new Error('NASA did not provide valid archive pagination details. Please try again.');
				}
			}

			archiveRecords.push(...pageRecords);
			page += 1;
		}

		// Turn each archive article into the same shape used by the gallery.
		const apodItems = archiveRecords
			.filter((record) => record.slug?.startsWith('apod-'))
			.map((record) => {
				const content = new DOMParser().parseFromString(record.content.rendered, 'text/html');
				const titleDocument = new DOMParser().parseFromString(record.title.rendered, 'text/html');
				const title = titleDocument.body.textContent.trim()
					.replace(/^APOD:\s*/i, '')
					.replace(/^\d{4}\s+[A-Za-z]+\s+\d+\s*[–-]\s*/, '');
				const explanationParagraph = Array.from(content.querySelectorAll('p'))
					.find((paragraph) => paragraph.textContent.trim().startsWith('Explanation:'));
				const image = content.querySelector('img[src]');
				const video = content.querySelector('iframe[src]');
				const explanation = explanationParagraph?.textContent
					.trim()
					.replace(/^Explanation:\s*/, '');

				if (!explanation) {
					throw new Error(`NASA's archive did not provide an explanation for ${record.date.slice(0, 10)}.`);
				}

				return {
					date: record.date.slice(0, 10),
					title,
					explanation,
					media_type: video ? 'video' : 'image',
					url: video?.getAttribute('src') || image?.getAttribute('src'),
					thumbnail_url: image?.getAttribute('src')
				};
			})
			.sort((first, second) => first.date.localeCompare(second.date));

		if (apodItems.length === 0) {
			gallery.textContent = 'No Astronomy Picture of the Day entries were found for those dates.';
			return;
		}

		gallery.replaceChildren();

		apodItems.forEach((item) => {
			const card = document.createElement('article');
			card.className = 'gallery-item';

			const isImage = item.media_type === 'image';
			const isVideo = item.media_type === 'video';
			const imageUrl = isImage ? item.url : item.thumbnail_url;
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

			if (isImage) {
				card.setAttribute('role', 'button');
				card.setAttribute('aria-label', `Open details for ${item.title}, ${item.date}`);
				card.tabIndex = 0;
				card.addEventListener('click', () => openApodDialog(item, largeImageUrl));
				card.addEventListener('keydown', (event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						openApodDialog(item, largeImageUrl);
					}
				});
			} else if (isVideo) {
				const videoLink = document.createElement('a');
				videoLink.className = 'gallery-video-link';
				videoLink.href = item.url;
				videoLink.textContent = 'Watch this APOD video';
				videoLink.target = '_blank';
				videoLink.rel = 'noopener noreferrer';
				card.appendChild(videoLink);
			}

			gallery.appendChild(card);
		});
	} catch (error) {
		console.error('Unable to load NASA APOD images:', error);
		gallery.textContent = error.message || 'Unable to load NASA images. Please try again.';
	} finally {
		gallery.setAttribute('aria-busy', 'false');
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

	apodDialog.showModal();
}

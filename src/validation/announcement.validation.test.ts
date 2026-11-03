import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAnnouncementStyleIssues,
  internalCreateAnnouncementBodySchema,
} from './announcement.validation';

const baseStyle = {
  displayStyle: 'feed_card',
  modalSize: 'medium',
  background: '',
};

test('accepts video and HTML media for feed cards', () => {
  assert.deepEqual(
    getAnnouncementStyleIssues({
      ...baseStyle,
      mediaType: 'video',
      mediaUrl: 'https://cdn.tripsi.app/announcement.mp4',
      htmlContent: '',
    }),
    [],
  );
  assert.deepEqual(
    getAnnouncementStyleIssues({
      ...baseStyle,
      mediaType: 'html',
      mediaUrl: '',
      htmlContent: '<section>Tripsi</section>',
    }),
    [],
  );
});

test('requires the media field used by a rich feed card', () => {
  assert.deepEqual(
    getAnnouncementStyleIssues({
      ...baseStyle,
      mediaType: 'video',
      mediaUrl: '',
      htmlContent: '',
    }).map((issue) => issue.path),
    [['mediaUrl']],
  );
  assert.deepEqual(
    getAnnouncementStyleIssues({
      ...baseStyle,
      mediaType: 'html',
      mediaUrl: '',
      htmlContent: '   ',
    }).map((issue) => issue.path),
    [['htmlContent']],
  );
});

test('create validation accepts a complete HTML feed card', () => {
  const result = internalCreateAnnouncementBodySchema.safeParse({
    internalName: 'Feed HTML card',
    title: 'Discover Tripsi',
    displayStyle: 'feed_card',
    mediaType: 'html',
    htmlContent: '<section>Tripsi</section>',
  });

  assert.equal(result.success, true);
});

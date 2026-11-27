# Students

Route: `/students`, `/students/:id`

The default list provides search, import, and Add student. The creation flow has first/last name, optional student email, required client picker, timezone, and recording-consent choice. A no-email student remains client-mediated and receives no direct sign-in invite. The captured picker-open and picker-selected states show a dedicated ARIA combobox/listbox relationship.

The synthetic student was created linked to the controlled test client; its populated detail state is captured.

## Email added after creation

The detail page's **Edit** action opens a modal with editable first name, last name, optional email, client, and timezone. Adding the controlled test email and saving changed the student's profile from a roster-only record to an invited account. Bobbin confirmed the invitation was sent and shows **Invite not accepted** until the student completes it. The confirmation also says organization emails wait until acceptance.

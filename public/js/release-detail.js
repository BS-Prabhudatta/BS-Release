const response = await fetch(`/admin/api/releases/${product}/${version}`, {
    method: 'PUT',
    headers: {
        'Content-Type': 'application/json',
        'CSRF-Token': csrfToken
    },
    body: JSON.stringify(data)
}); 
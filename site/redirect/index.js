// Sends the company's other addresses to figatner.industries, keeping the path and query.
export default {
    fetch(request) {
        const url = new URL(request.url)
        url.protocol = 'https:'
        url.host = 'figatner.industries'
        return Response.redirect(url.toString(), 301)
    },
}

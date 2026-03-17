import urllib.request
import ssl

ssl._create_default_https_context = ssl._create_unverified_context

urls = [
    ('https://pplx-res.cloudinary.com/image/upload/v1741830933/user_uploads/1751100427/images/1751100427-1.jpg', 'img/小草老师.png'),
    ('https://pplx-res.cloudinary.com/image/upload/v1741830933/user_uploads/1751100427/images/1751100427-2.jpg', 'img/小花老师.png'),
    ('https://pplx-res.cloudinary.com/image/upload/v1741830933/user_uploads/1751100427/images/1751100427-3.jpg', 'img/桃子老师.png'),
    ('https://pplx-res.cloudinary.com/image/upload/v1741830933/user_uploads/1751100427/images/1751100427-4.jpg', 'img/柚子老师.png')
]

for url, filename in urls:
    try:
        urllib.request.urlretrieve(url, filename)
        print(f'Downloaded: {filename}')
    except Exception as e:
        print(f'Error downloading {filename}: {e}')

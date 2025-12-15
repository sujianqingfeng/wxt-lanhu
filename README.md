# 蓝湖标注获取 


我需要获取一个元素下面所有元素的标注数据


网页链接
https://lanhuapp.com/web/#/item/project/detailDetach?tid=c70781e2-0237-47db-a76f-b9eed4122756&pid=3add85ce-7ee0-4a1f-9f50-68777e4d4269&project_id=3add85ce-7ee0-4a1f-9f50-68777e4d4269&image_id=20b09f01-daa3-4b05-88de-64098cac5406&fromEditor=true&type=image




第一步
请求url，获取 json_url

curl 'https://lanhuapp.com/api/project/image?dds_status=1&image_id=20b09f01-daa3-4b05-88de-64098cac5406&team_id=c70781e2-0237-47db-a76f-b9eed4122756&project_id=3add85ce-7ee0-4a1f-9f50-68777e4d4269' \
  -H 'accept: application/json, text/plain, */*' \
  -H 'accept-language: en-US,en;q=0.9' \
  -b 'aliyungf_tc=1fc3c4e18cbea3f668d65e3ff5dd297bbf8b3f9897bec5418326a28b623afed3; PASSPORT=CW6BOBQ2KRAVFPU7OF2T5DINP7VGOIW6ZSEHDN4LGVUUZL5SFD3IVIVOV5FWVE5ZLBRMEMVL4OHRTIZM6M6UVE54X3N2Y33HXQIOABI.F8D7F901B0F858AAD38B761249ED095A15069896; lanhu-login-center=8ebac9c9dffa26b427fd53b0baca9ced; tfstk=gVFtx6mqSwLTUM5C2CXhmyB18_Qnk94NJlzWimmMhkELYoH0mVXalriL0cDi1cmbDDiqfAXaI-ELkuQZirWaMIF0yIq0MrRxlrZV7mbNKPzZgjslq-Cu7PyvTzF4MAMQR4UBfCGfKXsFkD_Nq_fu5vr3QAIuI1O-JqujGVMjfp_KkVhXCqZjAvgSrhGjGo_KO4gD5hgsCH9IkDijGjZbRw3qAVGjGoaCJqlZrFoMC4RYIkIcqN9hgQd89VHtDCq9M4PwZfm7lDdfVW3Tc0asvIOjVbbpfrZfDIc7UkFxFo5vTf48dXgTpZ9IfYe_j2rAwCi_9PNsj5sHscNaR8V0AZOjDJwSecwFYsk_Ul2SpWj9T0wQJrDLLZJim8ub0YPc4Co_lzPzEbCvk2e8RXIyX7V8cg-o2qv1Jwp23AgUxf_p-WQIwKgKqNv63Kk-L2nlRm923ArKJ0b9hKJqL45..; _bl_uid=nFmpqjLX6Rgrw82OCazagI5qI9a0; user_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3OTczMTQ3MjgsImlkIjoiMTg1OTJlNWMtYTQ3Ni00MmI1LWI5ZjMtM2U4ZmVlMmUyMjAxIn0.hk3V6l-uBLecieT6aTJR_bZqkzbPJBjjO4eAho-8PMM; _ga=GA1.1.1451112647.1765779335; _ga_80BGNFFJQN=GS2.1.s1765779334$o1$g1$t1765779397$j60$l0$h0; acw_tc=19a2e6a617657805983201031f3c8f252b4fb887ae6117d03a2bd3cd8a00a8; session=.eJyM0E2KXDsMxfG9eHwvWF-2VJsxki13F--lUtyuJoOQvYfQZJ4FHPid_88y9pUf7-X2uj7zKOO-yq3EdKFa-4oQUppgsiNVtjai6tzJWfqehp0RMp3ZKlhQKmJdwAgCGZVt2ZxLefmuMslgSuNFMtnE2tTmudR3jWVJCtS7Q8dejjKeeX3zRz5ef2n_f3-7P8Z8z_nfCSqGKfN07u1kDDnDNp2UujMxESuUW1lB6bIMImwtkg2z1cYRyrUG2RgDepPetSNLHWM05e2TlqaYKEvjmlK7GyDGEilHef5YY98fb3k9r_sfXgFKc3dk7Ri5SbcnAuLOwISAcpTX5TO_4rokZHCeyZ1OZt2n-_STYmrY2jg5y1E-P_L6GvzT2V-_AwAA__-ZD4Hn.aT-w6w.GAXsppXnFz3LNcHcRxUHGPfsDeY; SERVERID=84a91decd161a53f98fb4002cd897566|1765782168|1765778634' \
  -H 'dnt: 1' \
  -H 'eagleeye-pappname: hlza1wchqe@558124c0f4f3c8f' \
  -H 'eagleeye-sessionid: pqm72jaX6sqt9a4km00Ubted8pwp' \
  -H 'eagleeye-traceid: 1a5be03a17657821687361016f3c8f' \
  -H 'last-request-session-id: c8d53f8e-990d-4582-8d1f-389888db44a7-1765778636814' \
  -H 'priority: u=1, i' \
  -H 'real-path: /item/project/detailDetach' \
  -H 'referer: https://lanhuapp.com/web/' \
  -H 'request-from: web' \
  -H 'request-session-id: 8984f257-f9c4-44c9-bcc3-e7b1e108742f-1765782167527' \
  -H 'sec-ch-ua: "Chromium";v="143", "Not A(Brand";v="24"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-origin' \
  -H 'session-id: 7e388e68-ea4e-4798-8331-228f29ed3515-1765782167400' \
  -H 'traceid: 840edc0469bb4751a31012e96fb09e2e1215150248' \
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'



返回

```
{
    "code": "00000",
    "msg": "success",
    "result": {
        "batch": "",
        "category_cover": [],
        "create_time": "2022-08-11T19:25:09.961828Z",
        "dds_jump_status": 1,
        "group": [],
        "height": 256.0,
        "home": false,
        "id": "20b09f01-daa3-4b05-88de-64098cac5406",
        "is_replaced": false,
        "last_version_num": 1,
        "lat": [],
        "latest_version": "3e5d837f-46ad-40a0-8f09-a62efb5abeac",
        "layout_data": "{\"scrollInfo\": {\"artboardHeight\": 1024, \"artboardWidth\": 1440, \"viewportHeight\": 1366, \"viewportWidth\": 1024, \"sliceScale\": 2, \"artboardScale\": 1}, \"hostType\": \"sketch\", \"exportScale\": 2, \"uid\": \"715b2369-1baa-4831-b1de-ef38cdff0d7b\", \"file_info\": {\"format\": \"png\"}}",
        "name": "STEP 6",
        "order": 0,
        "pinyinname": "z",
        "position_x": 3595.0,
        "position_y": 331.0,
        "positions": [],
        "pre": [],
        "share_id": "20b09f01-daa3-4b05-88de-64098cac5406",
        "sketch_id": "99f5d64f-9018-4fa2-b1c5-89ce0bc4e7b4",
        "source": false,
        "text_scale": null,
        "trash_recovery": false,
        "type": "image",
        "update_time": "2024-03-28T03:54:35.745316Z",
        "url": "https://alipic.lanhuapp.com/SketchCoverb8208a459f0b9709725a306758cd311e22c52d5973012d4bd09c84888308e22e",
        "user_id": null,
        "user_in_project": false,
        "versions": [
            {
                "id": "3e5d837f-46ad-40a0-8f09-a62efb5abeac",
                "type": "image",
                "create_time": "Thu, 28 Mar 2024 03:54:35 UTC",
                "version_info": "版本1",
                "url": "https://alipic.lanhuapp.com/SketchCoverb8208a459f0b9709725a306758cd311e22c52d5973012d4bd09c84888308e22e",
                "json_url": "https://alipic.lanhuapp.com/SketchJSONf62e96e9c8e6c719e83a894520146d91a143fb1b307b315457f1aa248b93ab28",
                "d2c_url": null,
                "version_layout_data": "{\"scrollInfo\": {\"artboardHeight\": 1024, \"artboardWidth\": 1440, \"viewportHeight\": 1366, \"viewportWidth\": 1024, \"sliceScale\": 2, \"artboardScale\": 1}, \"hostType\": \"sketch\", \"exportScale\": 2, \"uid\": \"715b2369-1baa-4831-b1de-ef38cdff0d7b\", \"file_info\": {\"format\": \"png\"}}",
                "md5": null,
                "updated": true,
                "editor_info": {
                    "nickname": "lanhuzhushou",
                    "avatar": "",
                    "color": "cyan"
                },
                "comments": []
            }
        ],
        "width": 360.0
    }
}
```





然后请求 url，https://alipic.lanhuapp.com/SketchJSONf62e96e9c8e6c719e83a894520146d91a143fb1b307b315457f1aa248b93ab28 返回数据 @result.json，这个里面就有标注数据


现在有一个问题，因为在我页面元素上面拿不到选中的元素 id，所以你看看如何设计好一点


